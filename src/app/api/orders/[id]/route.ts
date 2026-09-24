import { jsonError } from "@/lib/api";
import { publicJob } from "@/lib/public-shop";
import { getDatabase } from "@/lib/store";

/** GET /api/orders/:id — the live status screen on the customer's phone. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/orders/[id]">,
) {
  const { id } = await ctx.params;
  const db = await getDatabase();
  const job = db.jobs.find((item) => item.id === id);

  if (!job) return jsonError(404, "No order with that ID");

  return Response.json(
    { order: publicJob(job), shopName: db.shop.name },
    { headers: { "cache-control": "no-store" } },
  );
}
