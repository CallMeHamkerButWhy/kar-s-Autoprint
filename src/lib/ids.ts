import { randomBytes, randomUUID } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Short, unambiguous code people can read off a screen or a printed page. */
export function newJobCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function newApiKey(): string {
  return `apk_live_${randomBytes(24).toString("base64url")}`;
}

export function newAgentToken(): string {
  return `agt_${randomBytes(24).toString("base64url")}`;
}
