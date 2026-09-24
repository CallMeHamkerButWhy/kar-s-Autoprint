import { authFailure, checkAgentToken } from "@/lib/api";
import { addEvent, getDatabase, mutate, routePrinter, setStatus } from "@/lib/store";

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

      let printer = database.printers.find((item) => item.id === job.printerId) ?? null;
      const unreachable =
        printer != null &&
        reported.length > 0 &&
        !reported.includes(printer.systemName.toLowerCase());

      // The chosen printer may be gone or switched off. If this computer has
      // another queue that can do the job, move it rather than stall.
      if (printer == null || unreachable) {
        const alternative = routePrinter(database, job.documents, { among: reported });
        if (!alternative) continue;
        if (alternative.id !== job.printerId) {
          job.printerId = alternative.id;
          addEvent(
            job,
            "routed",
            printer
              ? `Moved to ${alternative.name} — ${printer.name} was not reachable`
              : `Routed to ${alternative.name}`,
          );
        }
        printer = alternative;
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
