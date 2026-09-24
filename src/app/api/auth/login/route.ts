import { hashPassword, normaliseShopId, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { setSessionCookie } from "@/lib/session";
import { findShop, mutate, startSession } from "@/lib/store";

/**
 * Shop ID plus password, the same pair the owner already uses at the counter.
 * Wrong ID and wrong password give the same answer so this cannot be used to
 * find out which shop IDs exist.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    shopId?: unknown;
    password?: unknown;
  };

  const shopId = typeof body.shopId === "string" ? normaliseShopId(body.shopId) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!shopId || !password) {
    return jsonError(400, "Enter your Shop ID and password.");
  }

  const outcome = await mutate(async (db) => {
    const shop = findShop(db, shopId);
    if (!shop) return null;

    // An install upgraded from the single-shop build has no password yet; the
    // first login sets one rather than locking the owner out of their own data.
    if (shop.passwordHash === "") {
      shop.passwordHash = await hashPassword(password);
    } else if (!(await verifyPassword(password, shop.passwordHash))) {
      return null;
    }

    return { token: startSession(db, shop.id), name: shop.name, id: shop.id };
  });

  if (!outcome) return jsonError(401, "That Shop ID and password do not match.");

  await setSessionCookie(outcome.token);
  return Response.json({ shop: { id: outcome.id, name: outcome.name } });
}
