import type { ColorMode, Database, PaperSize } from "@/lib/types";
import { PAPER_SIZES } from "@/lib/types";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function jsonError(status: number, message: string, extra?: object) {
  return Response.json({ error: message, ...extra }, { status });
}

function presentedToken(request: Request, header: string) {
  const direct = request.headers.get(header);
  if (direct) return direct.trim();
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

function tokensMatch(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkAgentToken(request: Request, db: Database) {
  const token = presentedToken(request, "x-agent-token");
  if (!token) return "missing" as const;
  return tokensMatch(token, db.shop.agentToken) ? ("ok" as const) : ("invalid" as const);
}

export function checkApiKey(request: Request, db: Database) {
  const token = presentedToken(request, "x-api-key");
  if (!token) return "missing" as const;
  return tokensMatch(token, db.shop.apiKey) ? ("ok" as const) : ("invalid" as const);
}

export function authFailure(result: "missing" | "invalid", kind: "agent token" | "API key") {
  if (result === "invalid") return jsonError(403, `Invalid ${kind}.`);
  const header = kind === "agent token" ? "X-Agent-Token" : "X-API-Key";
  return jsonError(401, `Missing ${kind}. Send it in the ${header} header.`);
}

export function parsePaperSize(value: unknown, fallback: PaperSize = "A4"): PaperSize {
  if (typeof value !== "string") return fallback;
  const normalised = value.trim().toLowerCase();
  return PAPER_SIZES.find((size) => size.toLowerCase() === normalised) ?? fallback;
}

export function parseColorMode(value: unknown, fallback: ColorMode = "bw"): ColorMode {
  if (typeof value !== "string") return fallback;
  const normalised = value.trim().toLowerCase();
  if (["color", "colour", "rgb"].includes(normalised)) return "color";
  if (["bw", "b/w", "mono", "black", "grayscale", "greyscale"].includes(normalised)) {
    return "bw";
  }
  return fallback;
}

export function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["true", "1", "yes", "on"].includes(value.trim().toLowerCase())) return true;
    if (["false", "0", "no", "off"].includes(value.trim().toLowerCase())) return false;
  }
  return fallback;
}

export function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function isPrintableType(contentType: string, fileName: string) {
  if (ACCEPTED_TYPES.includes(contentType)) return true;
  return /\.(pdf|png|jpe?g|webp)$/i.test(fileName);
}

export function guessContentType(fileName: string, fallback?: string | null) {
  if (fallback && ACCEPTED_TYPES.includes(fallback)) return fallback;
  const ext = fileName.toLowerCase().split(".").pop();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return (ext && map[ext]) || "application/octet-stream";
}
