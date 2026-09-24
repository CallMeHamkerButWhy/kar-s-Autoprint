import { jsonError } from "@/lib/api";
import { newAgentToken, newApiKey } from "@/lib/ids";
import { mutate } from "@/lib/store";

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

  const shop = await mutate((db) => {
    if (body.credential === "agentToken") {
      db.shop.agentToken = newAgentToken();
      for (const printer of db.printers) {
        printer.lastSeenAt = null;
        printer.agentVersion = null;
      }
    } else {
      db.shop.apiKey = newApiKey();
    }
    return db.shop;
  });

  return Response.json({ shop });
}
