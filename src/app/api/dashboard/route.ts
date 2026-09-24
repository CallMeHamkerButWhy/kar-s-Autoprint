import { buildDashboard } from "@/lib/dashboard";
import { getDatabase } from "@/lib/store";

/** GET /api/dashboard — everything the operator screens render from. */
export async function GET() {
  const db = await getDatabase();
  return Response.json(buildDashboard(db), {
    headers: { "cache-control": "no-store" },
  });
}
