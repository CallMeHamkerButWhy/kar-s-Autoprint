import { jsonError } from "@/lib/api";
import { newAgentToken, newApiKey } from "@/lib/ids";
import { currentShop } from "@/lib/session";
import { findShop, mutate, shopPrinters } from "@/lib/store";

/**
 * POST /api/settings/rotate — issue a new credential.
 *
 * Rotating the agent token is the "disconnect this computer" button: the old
 * shop PC stops being able to claim jobs the moment it is replaced.
 */
export async function POST(request: Request) {
  let body: { credential?: "agentToken" | "apiKey" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(400, "Body must be JSON: { credential }");
  }

  if (body.credential !== "agentToken" && body.credential !== "apiKey") {
    return jsonError(400, "credential must be 'agentToken' or 'apiKey'");
  }

  const signedIn = await currentShop();
  if (!signedIn) return jsonError(401, "Sign in to your shop first.");

  const shop = await mutate((db) => {
    const target = findShop(db, signedIn.id);
    if (!target) return null;

    if (body.credential === "agentToken") {
      target.agentToken = newAgentToken();
      for (const printer of shopPrinters(db, target.id)) {
        printer.lastSeenAt = null;
        printer.agentVersion = null;
      }
    } else {
      target.apiKey = newApiKey();
    }
    return target;
  });

  if (!shop) return jsonError(404, "That shop no longer exists.");
  return Response.json({ shop });
}
