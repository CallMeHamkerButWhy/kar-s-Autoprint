import { authFailure, checkAgentToken } from "@/lib/api";
import { getDatabase, mutate, setStatus } from "@/lib/store";

/**
 * POST /api/agent/claim — hands queued jobs to the shop computer.
 *
 * Claiming flips the job to "printing" inside the same lock, so two agents (or
 * one agent polling twice) can never print the same document.
 */
export async function POST(request: Request) {
  const db = await getDatabase();
  const auth = checkAgentToken(request, db);
  if (auth !== "ok") return authFailure(auth, "agent token");

  let body: { printers?: string[]; max?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Defaults below cover an empty body.
  }

  const reported = (body.printers ?? []).map((name) => name.toLowerCase());
  const max = Math.min(Math.max(Number(body.max ?? 1) || 1, 1), 5);

  const result = await mutate((database) => {
    if (!database.shop.autoPrintEnabled) {
      return { paused: "auto_print_off" as const, jobs: [] };
    }
    if (!database.shop.isOpen) {
      return { paused: "shop_closed" as const, jobs: [] };
    }

    const queue = database.jobs
      .filter((job) => job.status === "queued")
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

    const jobs = [];
    for (const job of queue) {
      if (jobs.length >= max) break;

      const printer = database.printers.find((item) => item.id === job.printerId);
      if (!printer) continue;
      if (reported.length > 0 && !reported.includes(printer.systemName.toLowerCase())) {
        continue;
      }

      job.attempts += 1;
      job.claimedAt = new Date().toISOString();
      setStatus(job, "printing", "claimed", `Sent to ${printer.name}`);

      jobs.push({
        id: job.id,
        code: job.code,
        printer: printer.systemName,
        printerName: printer.name,
        attempt: job.attempts,
        maxAttempts: database.shop.maxAttempts,
        customerName: job.customerName,
        documents: job.documents.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          contentType: document.contentType,
          byteSize: document.byteSize,
          pages: document.pages,
          copies: document.copies,
          color: document.color,
          paperSize: document.paperSize,
          duplex: document.duplex,
          downloadPath: `/api/agent/jobs/${job.id}/documents/${document.id}`,
        })),
      });
    }

    return { paused: null, jobs };
  });

  return Response.json(result);
}
