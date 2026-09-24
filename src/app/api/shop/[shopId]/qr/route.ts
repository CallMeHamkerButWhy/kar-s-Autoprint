import QRCode from "qrcode";

import { jsonError, publicBaseUrl } from "@/lib/api";
import { getDatabase } from "@/lib/store";

/**
 * GET /api/shop/:shopId/qr — the QR the shop prints and sticks on the counter.
 * It points at the customer upload page for this shop.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/shop/[shopId]/qr">,
) {
  const { shopId } = await ctx.params;
  const db = await getDatabase();

  if (db.shop.id.toLowerCase() !== shopId.toLowerCase()) {
    return jsonError(404, "No shop with that ID");
  }

  const target = `${publicBaseUrl(request)}/print/${db.shop.id}`;

  const svg = await QRCode.toString(target, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111827", light: "#ffffff" },
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "no-store",
    },
  });
}
