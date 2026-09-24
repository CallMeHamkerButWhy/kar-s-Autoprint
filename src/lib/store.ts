import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { newAgentToken, newApiKey, newId, newJobCode } from "@/lib/ids";
import { priceDocument } from "@/lib/pricing";
import type {
  ColorMode,
  Database,
  JobDocument,
  JobEventType,
  JobStatus,
  PaperSize,
  PrintJob,
  Printer,
  PrinterRole,
  Shop,
} from "@/lib/types";

const DATA_DIR = process.env.AUTOPRINT_DATA_DIR
  ? path.resolve(process.env.AUTOPRINT_DATA_DIR)
  : path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const FILES_DIR = path.join(DATA_DIR, "files");

/**
 * Every read-modify-write goes through this chain, so two agents polling at the
 * same moment cannot claim the same job and writes cannot clobber each other.
 */
let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const result = lock.then(task, task);
  lock = result.catch(() => undefined);
  return result;
}

function defaultShop(): Shop {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return {
    id: process.env.AUTOPRINT_SHOP_ID?.toUpperCase() || `SHOP_${suffix}`,
    name: "My Print Shop",
    phone: "",
    address: "",
    isOpen: true,
    supplyStatus: "ok",
    notice: null,
    rates: {
      bw: 5,
      color: 10,
      a3: { bw: 20, color: 40 },
      a2: { bw: 40, color: 80 },
      a1: { bw: 80, color: 150 },
      pageRanges: [
        { fromPages: 20, bw: 4, color: 9 },
        { fromPages: 50, bw: 3, color: 8 },
      ],
    },
    paymentMode: "both",
    approvalMode: "auto",
    autoPrintEnabled: true,
    maxAttempts: 3,
    claimTimeoutSeconds: 120,
    maxFilesPerOrder: 5,
    agentToken: newAgentToken(),
    apiKey: newApiKey(),
    createdAt: new Date().toISOString(),
  };
}

async function ensureDirs() {
  await mkdir(FILES_DIR, { recursive: true });
}

async function readDatabase(): Promise<Database> {
  try {
    return JSON.parse(await readFile(DB_PATH, "utf8")) as Database;
  } catch {
    // Printers are not invented here: the agent reports what the shop really has.
    const fresh: Database = { shop: defaultShop(), printers: [], jobs: [] };
    await writeDatabase(fresh);
    return fresh;
  }
}

async function writeDatabase(db: Database) {
  await ensureDirs();
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await rename(tmp, DB_PATH);
}

export function getDatabase(): Promise<Database> {
  return withLock(async () => {
    const db = await readDatabase();
    if (requeueStaleJobs(db)) await writeDatabase(db);
    return db;
  });
}

export function mutate<T>(task: (db: Database) => Promise<T> | T): Promise<T> {
  return withLock(async () => {
    const db = await readDatabase();
    requeueStaleJobs(db);
    const result = await task(db);
    await writeDatabase(db);
    return result;
  });
}

/** An agent that died mid-print must not leave a job stuck forever. */
function requeueStaleJobs(db: Database): boolean {
  const cutoff = Date.now() - db.shop.claimTimeoutSeconds * 1000;
  let changed = false;

  for (const job of db.jobs) {
    if (job.status !== "printing" || !job.claimedAt) continue;
    if (new Date(job.claimedAt).getTime() > cutoff) continue;

    const reason = "The shop computer stopped responding mid-print";
    if (job.attempts >= db.shop.maxAttempts) {
      job.lastError = reason;
      setStatus(job, "failed", "failed", reason);
    } else {
      setStatus(job, "queued", "retried", `${reason} — back in the queue`);
    }
    job.claimedAt = null;
    changed = true;
  }

  return changed;
}

export function setStatus(
  job: PrintJob,
  status: JobStatus,
  event: JobEventType,
  message: string,
) {
  job.status = status;
  job.updatedAt = new Date().toISOString();
  job.events.push({ at: job.updatedAt, type: event, message });
}

export function addEvent(job: PrintJob, type: JobEventType, message: string) {
  job.updatedAt = new Date().toISOString();
  job.events.push({ at: job.updatedAt, type, message });
}

export async function storeFile(bytes: Buffer, fileName: string) {
  await ensureDirs();
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 20);
  const ext = path.extname(fileName).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 8);
  const stored = `${digest}${ext || ".bin"}`;
  await writeFile(path.join(FILES_DIR, stored), bytes);
  return stored;
}

export function filePath(stored: string) {
  return path.join(FILES_DIR, path.basename(stored));
}

export function readStoredFile(stored: string) {
  return readFile(filePath(stored));
}

/**
 * Wipes the server's copy of every document in a job. Called as soon as the
 * print is confirmed, which is the promise the product is sold on.
 */
export function detachJobFiles(job: PrintJob) {
  const removed: string[] = [];
  for (const document of job.documents) {
    if (!document.storedFile) continue;
    removed.push(document.storedFile);
    document.storedFile = null;
  }
  return removed;
}

export async function purgeUnreferencedFiles(db: Database, candidates: string[]) {
  const stillUsed = new Set(
    db.jobs.flatMap((job) =>
      job.documents.map((document) => document.storedFile).filter(Boolean),
    ) as string[],
  );

  for (const stored of new Set(candidates)) {
    if (stillUsed.has(stored)) continue;
    await rm(filePath(stored), { force: true });
  }
}

export interface DocumentInput {
  fileName: string;
  contentType: string;
  bytes: Buffer;
  pages: number;
  copies: number;
  color: ColorMode;
  paperSize: PaperSize;
  duplex: boolean;
}

export interface CreateJobInput {
  documents: DocumentInput[];
  customerName?: string | null;
  customerPhone?: string | null;
  note?: string | null;
  paymentMethod: "counter" | "online";
  source: PrintJob["source"];
}

const REACHABLE_WINDOW_MS = 90_000;

function isReachable(printer: Printer) {
  if (!printer.lastSeenAt) return false;
  return Date.now() - new Date(printer.lastSeenAt).getTime() < REACHABLE_WINDOW_MS;
}

/** A printer the agent can reach beats a nicer one that is switched off. */
function bestOf(printers: Printer[]): Printer | null {
  if (printers.length === 0) return null;
  return (
    printers.find((printer) => isReachable(printer) && printer.isDefault) ??
    printers.find(isReachable) ??
    printers.find((printer) => printer.isDefault) ??
    printers[0]
  );
}

/**
 * Which printer should this job go to, based on what the documents need.
 *
 * Pass `among` to limit the choice to the queues one shop computer reported,
 * which is how a job survives the owner swapping printers around.
 */
export function routePrinter(
  db: Database,
  documents: JobDocument[],
  { among }: { among?: string[] } = {},
): Printer | null {
  const allowed = among?.map((name) => name.toLowerCase());
  const pool =
    allowed && allowed.length > 0
      ? db.printers.filter((printer) =>
          allowed.includes(printer.systemName.toLowerCase()),
        )
      : db.printers;
  if (pool.length === 0) return null;

  const needs: PrinterRole[] = [];
  if (documents.some((document) => ["A3", "A2", "A1"].includes(document.paperSize))) {
    needs.push("a3");
  }
  if (documents.some((document) => document.color === "color")) needs.push("color");
  if (documents.every((document) => document.color === "bw")) needs.push("bw");

  for (const role of needs) {
    const match = bestOf(pool.filter((printer) => printer.roles.includes(role)));
    if (match) return match;
  }

  return bestOf(pool);
}

export async function createJob(
  db: Database,
  input: CreateJobInput,
): Promise<PrintJob> {
  const now = new Date().toISOString();
  const documents: JobDocument[] = [];

  for (const document of input.documents) {
    const { amount } = priceDocument(db.shop.rates, document);
    documents.push({
      id: newId("doc"),
      fileName: document.fileName,
      contentType: document.contentType,
      byteSize: document.bytes.byteLength,
      pages: document.pages,
      copies: document.copies,
      color: document.color,
      paperSize: document.paperSize,
      duplex: document.duplex,
      storedFile: await storeFile(document.bytes, document.fileName),
      amount,
      printedAt: null,
      error: null,
    });
  }

  const job: PrintJob = {
    id: newId("job"),
    code: newJobCode(),
    shopId: db.shop.id,
    createdAt: now,
    updatedAt: now,
    status: "awaiting_payment",
    customerName: input.customerName?.trim() || null,
    customerPhone: input.customerPhone?.trim() || null,
    note: input.note?.trim() || null,
    documents,
    totalPages: documents.reduce(
      (total, document) => total + document.pages * document.copies,
      0,
    ),
    amount: documents.reduce((total, document) => total + document.amount, 0),
    payment: {
      method: input.paymentMethod,
      status: "pending",
      reference: null,
      paidAt: null,
    },
    printerId: null,
    attempts: 0,
    lastError: null,
    claimedAt: null,
    printedAt: null,
    serverFilesDeletedAt: null,
    agentFilesDeletedAt: null,
    source: input.source,
    events: [
      {
        at: now,
        type: "received",
        message:
          input.source === "qr"
            ? `${documents.length} ${documents.length === 1 ? "file" : "files"} uploaded from the customer's phone`
            : `${documents.length} ${documents.length === 1 ? "file" : "files"} received`,
      },
    ],
  };

  const printer = routePrinter(db, documents);
  job.printerId = printer?.id ?? null;
  if (printer) {
    addEvent(job, "routed", `Routed to ${printer.name}`);
  } else {
    addEvent(job, "routed", "No printer configured yet — waiting");
  }

  db.jobs.unshift(job);
  return job;
}

/**
 * Puts a job in front of the printer: straight into the queue, or into the
 * approval list when the counter wants to eyeball jobs first.
 */
export function release(db: Database, job: PrintJob) {
  if (db.shop.approvalMode === "manual") {
    setStatus(
      job,
      "awaiting_approval",
      "approved",
      "Waiting for the counter to approve",
    );
  } else {
    setStatus(job, "queued", "routed", "Added to the print queue");
  }
}

/** Online payment landed, so the job can print without anyone touching it. */
export function markPaid(db: Database, job: PrintJob, reference: string) {
  job.payment.status = "paid";
  job.payment.paidAt = new Date().toISOString();
  job.payment.reference = reference;
  addEvent(job, "paid", `Paid online · ${reference}`);
  release(db, job);
}

/** Cash at the counter: the shop owner confirms it later from the dashboard. */
export function markCashCollected(job: PrintJob) {
  job.payment.status = "paid";
  job.payment.paidAt = new Date().toISOString();
  addEvent(job, "paid", "Cash collected at the counter");
}

export function approveJob(job: PrintJob) {
  setStatus(job, "queued", "approved", "Approved at the counter");
}
