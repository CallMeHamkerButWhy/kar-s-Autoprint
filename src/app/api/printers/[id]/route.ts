import { jsonError, parsePaperSize } from "@/lib/api";
import { mutate } from "@/lib/store";
import type { PaperSize, PrinterRole } from "@/lib/types";

const ROLES: PrinterRole[] = ["bw", "color", "photo", "a3"];

/** PATCH /api/printers/:id — rename a queue or change what it prints. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/printers/[id]">,
) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "Body must be JSON");
  }

  const result = await mutate((db) => {
    const printer = db.printers.find((item) => item.id === id);
    if (!printer) return "missing" as const;

    if (typeof body.name === "string" && body.name.trim()) {
      printer.name = body.name.trim();
    }
    if (typeof body.systemName === "string" && body.systemName.trim()) {
      printer.systemName = body.systemName.trim();
    }
    if (typeof body.duplexCapable === "boolean") {
      printer.duplexCapable = body.duplexCapable;
    }
    if (Array.isArray(body.roles)) {
      const requested = body.roles as unknown[];
      printer.roles = ROLES.filter((role) => requested.includes(role));
    }
    if (Array.isArray(body.paperSizes) && body.paperSizes.length > 0) {
      printer.paperSizes = body.paperSizes.map((size) =>
        parsePaperSize(size),
      ) as PaperSize[];
    }
    if (body.isDefault === true) {
      for (const item of db.printers) item.isDefault = item.id === printer.id;
    }

    return printer;
  });

  if (result === "missing") return jsonError(404, "Unknown printer");
  return Response.json({ printer: result });
}

/** DELETE /api/printers/:id — forget a printer and re-route its open jobs. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/printers/[id]">,
) {
  const { id } = await ctx.params;

  const result = await mutate((db) => {
    const printer = db.printers.find((item) => item.id === id);
    if (!printer) return "missing" as const;

    db.printers = db.printers.filter((item) => item.id !== id);
    if (printer.isDefault && db.printers.length > 0) db.printers[0].isDefault = true;
    for (const job of db.jobs) {
      if (job.printerId === id) job.printerId = db.printers[0]?.id ?? null;
    }
    return "ok" as const;
  });

  if (result === "missing") return jsonError(404, "Unknown printer");
  return Response.json({ ok: true });
}
