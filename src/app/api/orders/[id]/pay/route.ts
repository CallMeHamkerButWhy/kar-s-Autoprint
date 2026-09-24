import { randomBytes } from "node:crypto";

import { jsonError } from "@/lib/api";
import { publicJob } from "@/lib/public-shop";
import type { PublicJob } from "@/lib/public-shop";
import { markPaid, mutate } from "@/lib/store";

type Outcome = { order: PublicJob } | { error: { status: number; message: string } };

/**
 * POST /api/orders/:id/pay — confirms an online payment.
 *
 * This stands in for the gateway callback. Razorpay or Cashfree would verify
 * the signature here and then call markPaid exactly the same way; nothing
 * downstream needs to change when that is wired up.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/orders/[id]/pay">,
) {
  const { id } = await ctx.params;

  const outcome = await mutate((db): Outcome => {
    const job = db.jobs.find((item) => item.id === id);
    if (!job) return { error: { status: 404, message: "No order with that ID" } };
    if (job.payment.status === "paid") {
      return { order: publicJob(job) };
    }
    if (job.status !== "awaiting_payment") {
      return {
        error: { status: 409, message: "This order is not waiting for payment" },
      };
    }

    markPaid(db, job, `MOCKPAY-${randomBytes(4).toString("hex").toUpperCase()}`);
    return { order: publicJob(job) };
  });

  if ("error" in outcome) {
    return jsonError(outcome.error.status, outcome.error.message);
  }
  return Response.json(outcome);
}
