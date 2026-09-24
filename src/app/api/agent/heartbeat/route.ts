import { authFailure, checkAgentToken } from "@/lib/api";
import { newId } from "@/lib/ids";
import { getDatabase, mutate } from "@/lib/store";
import type { Printer } from "@/lib/types";

interface HeartbeatBody {
  agentVersion?: string;
  host?: string;
  /** Queue names the shop computer can actually reach right now. */
  printers?: string[];
}

/**
 * POST /api/agent/heartbeat — the shop computer says "I am here, and these are
 * the printers I can see". That list is what the printer dropdowns offer, so
 * the owner never has to type a queue name by hand.
 */
export async function POST(request: Request) {
  const db = await getDatabase();
  const auth = checkAgentToken(request, db);
  if (auth !== "ok") return authFailure(auth, "agent token");

  let body: HeartbeatBody = {};
  try {
    body = (await request.json()) as HeartbeatBody;
  } catch {
    // A bare heartbeat still proves the agent is alive.
  }

  const reported = (body.printers ?? [])
    .filter((name): name is string => typeof name === "string" && name.trim() !== "")
    .map((name) => name.trim());
  const now = new Date().toISOString();

  const result = await mutate((database) => {
    const reportedLower = reported.map((name) => name.toLowerCase());

    for (const printer of database.printers) {
      const seen =
        reported.length === 0 ||
        reportedLower.includes(printer.systemName.toLowerCase());
      if (!seen) continue;
      printer.lastSeenAt = now;
      printer.agentVersion = body.agentVersion ?? printer.agentVersion;
      printer.reportedByAgent = reported.length > 0;
    }

    // Offer any new OS queue as an unassigned printer the owner can name.
    for (const name of reported) {
      const known = database.printers.some(
        (printer) => printer.systemName.toLowerCase() === name.toLowerCase(),
      );
      if (known) continue;

      const printer: Printer = {
        id: newId("prn"),
        name: name.replace(/[_-]+/g, " "),
        systemName: name,
        roles: database.printers.length === 0 ? ["bw", "color"] : [],
        duplexCapable: false,
        paperSizes: ["A4", "A5", "Letter", "Legal"],
        isDefault: database.printers.length === 0,
        createdAt: now,
        lastSeenAt: now,
        agentVersion: body.agentVersion ?? null,
        reportedByAgent: true,
      };
      database.printers.push(printer);
    }

    return {
      shopId: database.shop.id,
      shopName: database.shop.name,
      autoPrintEnabled: database.shop.autoPrintEnabled,
      claimTimeoutSeconds: database.shop.claimTimeoutSeconds,
      printers: database.printers.map((printer) => ({
        name: printer.name,
        systemName: printer.systemName,
        roles: printer.roles,
      })),
    };
  });

  return Response.json({ ok: true, serverTime: now, ...result });
}
