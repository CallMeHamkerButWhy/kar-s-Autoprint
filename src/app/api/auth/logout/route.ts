import { clearSessionCookie, sessionToken } from "@/lib/session";
import { endSession, mutate } from "@/lib/store";

export async function POST() {
  const token = await sessionToken();
  await mutate((db) => endSession(db, token));
  await clearSessionCookie();
  return Response.json({ ok: true });
}
