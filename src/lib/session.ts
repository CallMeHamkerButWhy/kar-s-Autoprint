import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { getDatabase, sessionShop } from "@/lib/store";
import type { Database, Shop } from "@/lib/types";

export async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The shop whose panel this browser is logged in to, if any. */
export async function currentShop(db?: Database): Promise<Shop | null> {
  return sessionShop(db ?? (await getDatabase()), await sessionToken());
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
