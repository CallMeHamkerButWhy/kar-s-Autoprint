import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_BYTES = 32;
export const SESSION_COOKIE = "kap_shop_session";
export const SESSION_DAYS = 30;

/**
 * Passwords are stored as `scrypt$<salt>$<key>`. scrypt ships with Node, so the
 * shop owner does not have to install a native module to run their own server.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_BYTES);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltPart, keyPart] = stored.split("$");
  if (scheme !== "scrypt" || !saltPart || !keyPart) return false;

  const expected = Buffer.from(keyPart, "base64url");
  const actual = await derive(password, Buffer.from(saltPart, "base64url"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Only the digest is kept, so the stored session cannot be replayed. */
export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(from = new Date()) {
  return new Date(from.getTime() + SESSION_DAYS * 86_400_000).toISOString();
}

/**
 * A shop ID is typed by hand into the agent and read off a poster, so treat
 * case and stray spaces as the same shop.
 */
export function normaliseShopId(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters";
  if (password.length > 200) return "That password is too long";
  return null;
}
