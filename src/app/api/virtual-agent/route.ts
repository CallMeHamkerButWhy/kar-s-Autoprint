import {
  addEvent,
  detachJobFiles,
  mutate,
  purgeUnreferencedFiles,
  setStatus,
} from "@/lib/store";

/**
 * POST /api/virtual-agent — prints the queue without a printer attached.
 *
 * It walks the exact same states as the real agent, including deleting the
 * files, so the flow can be demonstrated on any machine.
 */
export async function POST() {
  const result = await mutate(async (db) => {
    if (!db.shop.autoPrintEnabled) return { blocked: "auto_print_off" as const, printed: 0 };
    if (!db.shop.isOpen) return { blocked: "shop_closed" as const, printed: 0 };

    const now = new Date().toISOString();
    for (const printer of db.printers) {
      printer.lastSeenAt = now;
      printer.agentVersion = "virtual";
    }

    const queue = db.jobs
      .filter((job) => job.status === "queued")
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

    let printed = 0;
    for (const job of queue) {
      const printer = db.printers.find((item) => item.id === job.printerId);
      if (!printer) continue;

      job.attempts += 1;
      job.claimedAt = null;
      job.printedAt = new Date().toISOString();
      job.lastError = null;
      for (const document of job.documents) {
        document.printedAt = job.printedAt;
      }
      setStatus(
        job,
        "printed",
        "printed",
        `Printed on ${printer.name} by the virtual printer`,
      );

      const removed = detachJobFiles(job);
      if (removed.length > 0) {
        job.serverFilesDeletedAt = new Date().toISOString();
        job.agentFilesDeletedAt = job.serverFilesDeletedAt;
        addEvent(job, "file_deleted", "File deleted from the server and the computer");
        await purgeUnreferencedFiles(db, removed);
      }

      printed += 1;
      if (printed >= 10) break;
    }

    return { blocked: null, printed };
  });

  return Response.json({ ok: true, ...result });
}
