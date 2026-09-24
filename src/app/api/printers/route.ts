import { jsonError, parsePaperSize } from "@/lib/api";
import { newId } from "@/lib/ids";
import { currentShop } from "@/lib/session";
import { mutate, shopPrinters } from "@/lib/store";
import type { PaperSize, Printer, PrinterRole } from "@/lib/types";

const ROLES: PrinterRole[] = ["bw", "color", "photo", "a3"];

function parseRoles(value: unknown): PrinterRole[] {
  if (!Array.isArray(value)) return [];
  return ROLES.filter((role) => value.includes(role));
}

/** POST /api/printers — add a printer queue by hand. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "Body must be JSON");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const systemName =
    typeof body.systemName === "string" ? body.systemName.trim() : "";

  if (!name) return jsonError(400, "Give the printer a name");
  if (!systemName) {
    return jsonError(
      400,
      "The Windows or CUPS queue name is required, e.g. HP_LaserJet_M1005",
    );
  }

  const paperSizes = Array.isArray(body.paperSizes)
    ? (body.paperSizes.map((size) => parsePaperSize(size)) as PaperSize[])
    : [];

  const signedIn = await currentShop();
  if (!signedIn) return jsonError(401, "Sign in to your shop first.");

  const result = await mutate((db) => {
    const owned = shopPrinters(db, signedIn.id);
    if (
      owned.some(
        (printer) => printer.systemName.toLowerCase() === systemName.toLowerCase(),
      )
    ) {
      return "duplicate" as const;
    }

    const printer: Printer = {
      id: newId("prn"),
      shopId: signedIn.id,
      name,
      systemName,
      roles: parseRoles(body.roles),
      duplexCapable: body.duplexCapable === true,
      paperSizes: paperSizes.length > 0 ? paperSizes : ["A4"],
      isDefault: owned.length === 0 || body.isDefault === true,
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
      agentVersion: null,
      reportedByAgent: false,
    };

    if (printer.isDefault) {
      for (const item of owned) item.isDefault = false;
    }
    db.printers.push(printer);
    return printer;
  });

  if (result === "duplicate") {
    return jsonError(409, "A printer with that queue name already exists");
  }
  return Response.json({ printer: result }, { status: 201 });
}
