import { buildSimplePdf } from "@/lib/pdf";
import { formatRupees } from "@/lib/pricing";
import { addEvent, createJob, mutate, release } from "@/lib/store";
import type { ColorMode, PaperSize } from "@/lib/types";

type Kind = "bw" | "color" | "a3" | "multi";

/**
 * POST /api/jobs/test — queue a real printable PDF from the dashboard, so the
 * owner can prove the agent works without asking a customer to scan anything.
 */
export async function POST(request: Request) {
  let body: { kind?: Kind } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Default below is fine.
  }

  const kind: Kind = ["bw", "color", "a3", "multi"].includes(body.kind ?? "")
    ? (body.kind as Kind)
    : "bw";
  const stamp = new Date().toLocaleString("en-IN");

  const page = (title: string, extra: string[] = []) =>
    buildSimplePdf(title, [
      "If this page came out of the printer, auto print is working.",
      "Queued from the shop dashboard, printed by the local agent.",
      ...extra,
      "",
      `Test run: ${stamp}`,
    ]);

  const plans: Record<
    Kind,
    { fileName: string; color: ColorMode; paperSize: PaperSize; pages: number }[]
  > = {
    bw: [
      { fileName: "test-bw.pdf", color: "bw", paperSize: "A4", pages: 1 },
    ],
    color: [
      { fileName: "test-colour.pdf", color: "color", paperSize: "A4", pages: 1 },
    ],
    a3: [{ fileName: "test-a3.pdf", color: "bw", paperSize: "A3", pages: 1 }],
    multi: [
      { fileName: "notes.pdf", color: "bw", paperSize: "A4", pages: 1 },
      { fileName: "photo-page.pdf", color: "color", paperSize: "A4", pages: 1 },
    ],
  };

  const job = await mutate(async (db) => {
    const created = await createJob(db, {
      documents: plans[kind].map((plan) => ({
        fileName: plan.fileName,
        contentType: "application/pdf",
        bytes: page(`Test print — ${plan.paperSize} ${plan.color === "color" ? "colour" : "black & white"}`),
        pages: plan.pages,
        copies: 1,
        color: plan.color,
        paperSize: plan.paperSize,
        duplex: false,
      })),
      customerName: "Test print",
      paymentMethod: "counter",
      source: "dashboard",
    });

    addEvent(created, "received", `Test job worth ${formatRupees(created.amount)}`);
    release(db, created);
    return created;
  });

  return Response.json({ ok: true, id: job.id, code: job.code }, { status: 201 });
}
