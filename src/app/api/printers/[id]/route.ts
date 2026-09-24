import { jsonError, parsePaperSize } from "@/lib/api";
import { currentShop } from "@/lib/session";
import { mutate, shopJobs, shopPrinters } from "@/lib/store";
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

  const signedIn = await currentShop();
  if (!signedIn) return jsonError(401, "Sign in to your shop first.");

  const result = await mutate((db) => {
    const owned = shopPrinters(db, signedIn.id);
    const printer = owned.find((item) => item.id === id);
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
      for (const item of owned) item.isDefault = item.id === printer.id;
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

  const signedIn = await currentShop();
  if (!signedIn) return jsonError(401, "Sign in to your shop first.");

  const result = await mutate((db) => {
    const printer = shopPrinters(db, signedIn.id).find((item) => item.id === id);
    if (!printer) return "missing" as const;

    db.printers = db.printers.filter((item) => item.id !== id);
    const left = shopPrinters(db, signedIn.id);
    if (printer.isDefault && left.length > 0) left[0].isDefault = true;
    for (const job of shopJobs(db, signedIn.id)) {
      if (job.printerId === id) job.printerId = left[0]?.id ?? null;
    }
    return "ok" as const;
  });

  if (result === "missing") return jsonError(404, "Unknown printer");
  return Response.json({ ok: true });
}
