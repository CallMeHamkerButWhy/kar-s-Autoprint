import { jsonError } from "@/lib/api";
import { publicShop } from "@/lib/public-shop";
import { getDatabase } from "@/lib/store";

/** GET /api/shop/:shopId — what the customer's upload page needs to render. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/shop/[shopId]">,
) {
  const { shopId } = await ctx.params;
  const db = await getDatabase();

  if (db.shop.id.toLowerCase() !== shopId.toLowerCase()) {
    return jsonError(404, "No shop with that ID");
  }

  return Response.json(
    { shop: publicShop(db) },
    { headers: { "cache-control": "no-store" } },
  );
}
