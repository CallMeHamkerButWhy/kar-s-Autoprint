import { clampInt, jsonError } from "@/lib/api";
import { mutate } from "@/lib/store";
import type { PageRangeTier, PaymentMode, SupplyStatus } from "@/lib/types";

const PAYMENT_MODES: PaymentMode[] = ["counter", "online", "both"];
const SUPPLY: SupplyStatus[] = ["ok", "low_ink", "out_of_paper"];

function money(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 100) / 100;
}

/** PATCH /api/settings — shop details, rates, and the auto-print switches. */
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "Body must be JSON");
  }

  const shop = await mutate((db) => {
    const target = db.shop;

    if (typeof body.name === "string" && body.name.trim()) {
      target.name = body.name.trim().slice(0, 60);
    }
    if (typeof body.phone === "string") target.phone = body.phone.trim().slice(0, 20);
    if (typeof body.address === "string") {
      target.address = body.address.trim().slice(0, 140);
    }
    if (typeof body.isOpen === "boolean") target.isOpen = body.isOpen;
    if (typeof body.autoPrintEnabled === "boolean") {
      target.autoPrintEnabled = body.autoPrintEnabled;
    }
    if (typeof body.notice === "string") {
      target.notice = body.notice.trim().slice(0, 160) || null;
    }
    if (
      typeof body.supplyStatus === "string" &&
      SUPPLY.includes(body.supplyStatus as SupplyStatus)
    ) {
      target.supplyStatus = body.supplyStatus as SupplyStatus;
    }
    if (
      typeof body.paymentMode === "string" &&
      PAYMENT_MODES.includes(body.paymentMode as PaymentMode)
    ) {
      target.paymentMode = body.paymentMode as PaymentMode;
    }
    if (body.approvalMode === "auto" || body.approvalMode === "manual") {
      target.approvalMode = body.approvalMode;
    }
    if (body.maxAttempts != null) {
      target.maxAttempts = clampInt(body.maxAttempts, 1, 10, target.maxAttempts);
    }
    if (body.claimTimeoutSeconds != null) {
      target.claimTimeoutSeconds = clampInt(
        body.claimTimeoutSeconds,
        15,
        3600,
        target.claimTimeoutSeconds,
      );
    }
    if (body.maxFilesPerOrder != null) {
      target.maxFilesPerOrder = clampInt(
        body.maxFilesPerOrder,
        1,
        20,
        target.maxFilesPerOrder,
      );
    }

    if (body.rates && typeof body.rates === "object") {
      const rates = body.rates as Record<string, unknown>;
      target.rates.bw = money(rates.bw, target.rates.bw);
      target.rates.color = money(rates.color, target.rates.color);

      for (const size of ["a3", "a2", "a1"] as const) {
        const value = rates[size];
        if (value && typeof value === "object") {
          const pair = value as Record<string, unknown>;
          target.rates[size].bw = money(pair.bw, target.rates[size].bw);
          target.rates[size].color = money(pair.color, target.rates[size].color);
        }
      }

      if (Array.isArray(rates.pageRanges)) {
        target.rates.pageRanges = rates.pageRanges
          .map((tier) => {
            const item = tier as Record<string, unknown>;
            return {
              fromPages: clampInt(item.fromPages, 1, 10_000, 0),
              bw: money(item.bw, 0),
              color: money(item.color, 0),
            } satisfies PageRangeTier;
          })
          .filter((tier) => tier.fromPages > 0)
          .sort((a, b) => a.fromPages - b.fromPages)
          .slice(0, 5);
      }
    }

    return target;
  });

  return Response.json({ shop });
}
