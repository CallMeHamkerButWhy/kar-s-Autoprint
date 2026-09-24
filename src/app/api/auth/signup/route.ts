import { jsonError } from "@/lib/api";
import { hashPassword, passwordProblem } from "@/lib/auth";
import { newShopId } from "@/lib/ids";
import { setSessionCookie } from "@/lib/session";
import { buildShop, findShop, mutate, startSession } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    password?: unknown;
    phone?: unknown;
    address?: unknown;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2) return jsonError(400, "Enter your shop's name.");

  const weak = passwordProblem(password);
  if (weak) return jsonError(400, weak);

  const created = await mutate(async (db) => {
    let id = newShopId();
    while (findShop(db, id)) id = newShopId();

    const shop = buildShop({
      id,
      name,
      passwordHash: await hashPassword(password),
      phone: typeof body.phone === "string" ? body.phone.trim() : "",
      address: typeof body.address === "string" ? body.address.trim() : "",
    });
    db.shops.push(shop);
    return { shop, token: startSession(db, shop.id) };
  });

  await setSessionCookie(created.token);
  return Response.json(
    { shop: { id: created.shop.id, name: created.shop.name } },
    { status: 201 },
  );
}
