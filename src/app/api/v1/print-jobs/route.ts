import {
  MAX_FILE_BYTES,
  authFailure,
  checkApiKey,
  clampInt,
  guessContentType,
  isPrintableType,
  jsonError,
  parseBoolean,
  parseColorMode,
  parsePaperSize,
} from "@/lib/api";
import { countPdfPages } from "@/lib/pdf";
import { publicJob } from "@/lib/public-shop";
import { addEvent, createJob, getDatabase, mutate, release } from "@/lib/store";
import type { DocumentInput } from "@/lib/store";

/**
 * POST /api/v1/print-jobs — server-to-server ingest.
 *
 * This is the door for an existing website that already takes the upload and
 * the payment itself: it hands over a document and the job prints. The customer
 * QR flow in this app uses /api/shop/:shopId/orders instead.
 */
export async function POST(request: Request) {
  const db = await getDatabase();
  const auth = checkApiKey(request, db);
  if (auth !== "ok") return authFailure(auth, "API key");

  const contentType = request.headers.get("content-type") ?? "";

  let documents: DocumentInput[];
  let meta: {
    customerName: string | null;
    customerPhone: string | null;
    note: string | null;
    alreadyPaid: boolean;
  };

  try {
    const parsed = contentType.includes("multipart/form-data")
      ? await fromMultipart(request)
      : await fromJson(request);
    documents = parsed.documents;
    meta = parsed.meta;
  } catch (cause) {
    return jsonError(400, (cause as Error).message);
  }

  if (documents.length === 0) return jsonError(400, "Send at least one document");

  const job = await mutate(async (database) => {
    const created = await createJob(database, {
      documents,
      customerName: meta.customerName,
      customerPhone: meta.customerPhone,
      note: meta.note,
      paymentMethod: meta.alreadyPaid ? "online" : "counter",
      source: "api",
    });

    if (meta.alreadyPaid) {
      created.payment.status = "paid";
      created.payment.paidAt = new Date().toISOString();
      created.payment.reference = "collected by the website";
      addEvent(created, "paid", "Marked paid by the website");
    }
    release(database, created);

    return publicJob(created);
  });

  return Response.json({ job }, { status: 201 });
}

async function readOne(
  source: {
    fileName: string;
    contentType: string;
    bytes: Buffer;
  },
  options: {
    copies?: unknown;
    color?: unknown;
    paperSize?: unknown;
    duplex?: unknown;
  },
): Promise<DocumentInput> {
  if (source.bytes.byteLength === 0) throw new Error(`${source.fileName} is empty`);
  if (source.bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`${source.fileName} is larger than 25 MB`);
  }
  if (!isPrintableType(source.contentType, source.fileName)) {
    throw new Error(`${source.fileName} must be a PDF, JPG, PNG, or WEBP`);
  }

  return {
    fileName: source.fileName,
    contentType: source.contentType,
    bytes: source.bytes,
    pages:
      source.contentType === "application/pdf" ? countPdfPages(source.bytes) : 1,
    copies: clampInt(options.copies, 1, 50, 1),
    color: parseColorMode(options.color, "bw"),
    paperSize: parsePaperSize(options.paperSize, "A4"),
    duplex: parseBoolean(options.duplex, false),
  };
}

async function fromJson(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    throw new Error("Body must be JSON or multipart/form-data");
  }

  const str = (key: string) => {
    const value = body[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  const fileName = str("fileName") ?? "document.pdf";
  let bytes: Buffer;

  const base64 = str("fileBase64");
  const documentUrl = str("documentUrl");

  if (base64) {
    bytes = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
  } else if (documentUrl) {
    const response = await fetch(documentUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`Could not download documentUrl (HTTP ${response.status})`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error("Send fileBase64, documentUrl, or a multipart file");
  }

  const document = await readOne(
    {
      fileName,
      contentType: guessContentType(fileName, str("contentType")),
      bytes,
    },
    body,
  );

  return {
    documents: [document],
    meta: {
      customerName: str("customerName"),
      customerPhone: str("customerPhone"),
      note: str("note") ?? str("reference"),
      alreadyPaid: parseBoolean(body.paid, true),
    },
  };
}

async function fromMultipart(request: Request) {
  const form = await request.formData();
  const files = form.getAll("file").filter((part): part is File => part instanceof File);
  if (files.length === 0) throw new Error("Attach at least one 'file' part");

  const str = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  const documents: DocumentInput[] = [];
  for (const file of files) {
    documents.push(
      await readOne(
        {
          fileName: file.name || "document.pdf",
          contentType: guessContentType(file.name, file.type),
          bytes: Buffer.from(await file.arrayBuffer()),
        },
        {
          copies: form.get("copies"),
          color: form.get("color"),
          paperSize: form.get("paperSize"),
          duplex: form.get("duplex"),
        },
      ),
    );
  }

  return {
    documents,
    meta: {
      customerName: str("customerName"),
      customerPhone: str("customerPhone"),
      note: str("note") ?? str("reference"),
      alreadyPaid: parseBoolean(form.get("paid"), true),
    },
  };
}
