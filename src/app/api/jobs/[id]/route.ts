import { jsonError } from "@/lib/api";
import {
  addEvent,
  approveJob,
  detachJobFiles,
  markCashCollected,
  mutate,
  purgeUnreferencedFiles,
  routePrinter,
  setStatus,
} from "@/lib/store";

type Action = "approve" | "collect" | "retry" | "cancel";

type Outcome = { ok: true } | { error: { status: number; message: string } };

/**
 * POST /api/jobs/:id — counter actions on one job.
 *
 * Kept as one endpoint because the dashboard always knows which action it
 * wants, and each one is a two-line state change.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;

  let body: { action?: Action };
  try {
    body = (await request.json()) as { action?: Action };
  } catch {
    return jsonError(400, "Body must be JSON: { action }");
  }

  const action = body.action;
  if (!action || !["approve", "collect", "retry", "cancel"].includes(action)) {
    return jsonError(400, "action must be approve, collect, retry, or cancel");
  }

  const outcome = await mutate(async (db): Promise<Outcome> => {
    const job = db.jobs.find((item) => item.id === id);
    if (!job) return { error: { status: 404, message: "Unknown job" } };

    if (action === "approve") {
      if (job.status !== "awaiting_approval") {
        return { error: { status: 409, message: "That job is not waiting for approval" } };
      }
      approveJob(job);
      return { ok: true };
    }

    if (action === "collect") {
      if (job.payment.status === "paid") {
        return { error: { status: 409, message: "That job is already paid" } };
      }
      markCashCollected(job);
      return { ok: true };
    }

    if (action === "cancel") {
      if (job.status === "printed") {
        return { error: { status: 409, message: "That job already printed" } };
      }
      job.claimedAt = null;
      setStatus(job, "cancelled", "cancelled", "Cancelled at the counter");

      const removed = detachJobFiles(job);
      if (removed.length > 0) {
        job.serverFilesDeletedAt = new Date().toISOString();
        addEvent(job, "file_deleted", "File deleted from the server");
        await purgeUnreferencedFiles(db, removed);
      }
      return { ok: true };
    }

    // retry
    if (job.status === "queued" || job.status === "printing") {
      return { error: { status: 409, message: "That job is already on its way" } };
    }
    if (job.documents.every((document) => document.storedFile == null)) {
      return {
        error: {
          status: 410,
          message:
            "The files were deleted after printing, so this job cannot be reprinted. Ask the customer to upload again.",
        },
      };
    }

    job.attempts = 0;
    job.lastError = null;
    job.printedAt = null;
    job.claimedAt = null;
    for (const document of job.documents) {
      document.printedAt = null;
      document.error = null;
    }

    const printer = routePrinter(db, job.documents);
    job.printerId = printer?.id ?? null;
    setStatus(
      job,
      "queued",
      "retried",
      printer ? `Queued again for ${printer.name}` : "Queued again, no printer yet",
    );
    return { ok: true };
  });

  if ("error" in outcome) {
    return jsonError(outcome.error.status, outcome.error.message);
  }
  return Response.json(outcome);
}
