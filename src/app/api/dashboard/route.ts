import { jsonError } from "@/lib/api";
import { buildDashboard } from "@/lib/dashboard";
import { currentShop } from "@/lib/session";
import { getDatabase } from "@/lib/store";

/** GET /api/dashboard — everything the logged-in shop's screens render from. */
export async function GET() {
  const db = await getDatabase();
  const shop = await currentShop(db);
  if (!shop) return jsonError(401, "Sign in to your shop first.");

  return Response.json(buildDashboard(db, shop), {
    headers: { "cache-control": "no-store" },
  });
}
