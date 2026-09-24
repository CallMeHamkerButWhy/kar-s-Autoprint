import { authFailure, checkAgentToken, jsonError } from "@/lib/api";
import {
  addEvent,
  detachJobFiles,
  getDatabase,
  mutate,
  purgeUnreferencedFiles,
  setStatus,
} from "@/lib/store";

interface ResultBody {
  ok?: boolean;
  error?: string;
  /** Per-document outcome, so a partial failure can be reported honestly. */
  documents?: { id: string; ok: boolean; error?: string }[];
  /** The agent confirms it wiped its own temporary copy. */
  localFilesDeleted?: boolean;
}

/**
 * POST /api/agent/jobs/:id/result — the outcome of a print.
 *
 * On success the server copy of every document is deleted immediately, and the
 * agent's confirmation that it wiped its local copy is recorded too. Failures
 * go back in the queue until maxAttempts, keeping the file until then.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/agent/jobs/[id]/result">,
) {
  const db = await getDatabase();
  const auth = checkAgentToken(request, db);
  if (auth !== "ok") return authFailure(auth, "agent token");

  const { id } = await ctx.params;

  let body: ResultBody;
  try {
    body = (await request.json()) as ResultBody;
  } catch {
    return jsonError(400, "Body must be JSON: { ok: true } or { ok: false, error }");
  }

  const outcome = await mutate(async (database) => {
    const job = database.jobs.find((item) => item.id === id);
    if (!job) return null;

    job.claimedAt = null;

    for (const report of body.documents ?? []) {
      const document = job.documents.find((item) => item.id === report.id);
      if (!document) continue;
      if (report.ok) {
        document.printedAt = new Date().toISOString();
        document.error = null;
      } else {
        document.error = report.error?.trim() || "Print failed";
      }
    }

    if (body.ok) {
      const now = new Date().toISOString();
      job.printedAt = now;
      job.lastError = null;
      for (const document of job.documents) {
        document.printedAt = document.printedAt ?? now;
      }
      setStatus(
        job,
        "printed",
        "printed",
        `Printed ${job.totalPages} ${job.totalPages === 1 ? "page" : "pages"}`,
      );

      const removed = detachJobFiles(job);
      if (removed.length > 0) {
        job.serverFilesDeletedAt = new Date().toISOString();
        addEvent(job, "file_deleted", "File deleted from the server");
        await purgeUnreferencedFiles(database, removed);
      }
      if (body.localFilesDeleted) {
        job.agentFilesDeletedAt = new Date().toISOString();
        addEvent(job, "file_deleted", "File deleted from the shop computer");
      }

      return { status: job.status, attempts: job.attempts };
    }

    const message = body.error?.trim() || "The printer reported an error";
    job.lastError = message;

    if (job.attempts >= database.shop.maxAttempts) {
      setStatus(
        job,
        "failed",
        "failed",
        `${message} — stopped after ${job.attempts} ${job.attempts === 1 ? "try" : "tries"}`,
      );
    } else {
      setStatus(job, "queued", "retried", `${message} — trying again`);
    }

    return { status: job.status, attempts: job.attempts };
  });

  if (!outcome) return jsonError(404, "Unknown job");
  return Response.json({ ok: true, ...outcome });
}
