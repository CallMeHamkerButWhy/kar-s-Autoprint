import {
  MAX_FILE_BYTES,
  clampInt,
  guessContentType,
  isPrintableType,
  jsonError,
  parseBoolean,
  parseColorMode,
  parsePaperSize,
} from "@/lib/api";
import { countPdfPages } from "@/lib/pdf";
import { publicJob } from "@/lib/public-shop";
import { addEvent, createJob, mutate, release } from "@/lib/store";
import type { DocumentInput } from "@/lib/store";
import { formatRupees } from "@/lib/pricing";

interface OptionInput {
  copies?: unknown;
  color?: unknown;
  paperSize?: unknown;
  duplex?: unknown;
  pages?: unknown;
}

/**
 * POST /api/shop/:shopId/orders — the customer's phone submits the order.
 *
 * Multipart: one or more `file` parts, plus an `options` JSON array lining up
 * with the files, plus `paymentMethod`, `customerName`, `customerPhone`.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/shop/[shopId]/orders">,
) {
  const { shopId } = await ctx.params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Send the order as multipart/form-data");
  }

  const files = form.getAll("file").filter((part): part is File => part instanceof File);
  if (files.length === 0) return jsonError(400, "Attach at least one file");

  let options: OptionInput[] = [];
  const rawOptions = form.get("options");
  if (typeof rawOptions === "string" && rawOptions.trim()) {
    try {
      const parsed = JSON.parse(rawOptions);
      if (Array.isArray(parsed)) options = parsed as OptionInput[];
    } catch {
      return jsonError(400, "options must be a JSON array");
    }
  }

  const documents: DocumentInput[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size === 0) return jsonError(400, `${file.name} is empty`);
    if (file.size > MAX_FILE_BYTES) {
      return jsonError(413, `${file.name} is larger than 25 MB`);
    }

    const contentType = guessContentType(file.name, file.type);
    if (!isPrintableType(contentType, file.name)) {
      return jsonError(
        415,
        `${file.name} is not a PDF or an image. Send PDF, JPG, PNG, or WEBP.`,
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const option = options[index] ?? {};
    const pages =
      contentType === "application/pdf"
        ? countPdfPages(bytes)
        : clampInt(option.pages, 1, 1, 1);

    documents.push({
      fileName: file.name || `document-${index + 1}.pdf`,
      contentType,
      bytes,
      pages,
      copies: clampInt(option.copies, 1, 50, 1),
      color: parseColorMode(option.color, "bw"),
      paperSize: parsePaperSize(option.paperSize, "A4"),
      duplex: parseBoolean(option.duplex, false),
    });
  }

  const requestedMethod =
    form.get("paymentMethod") === "online" ? "online" : "counter";
  const customerName = form.get("customerName");
  const customerPhone = form.get("customerPhone");
  const note = form.get("note");

  const outcome = await mutate(async (db) => {
    const reject = (status: number, message: string) => ({
      error: { status, message },
    });

    if (db.shop.id.toLowerCase() !== shopId.toLowerCase()) {
      return reject(404, "No shop with that ID");
    }
    if (!db.shop.isOpen) {
      return reject(
        409,
        `${db.shop.name} is closed right now. Please try again when the shop reopens.`,
      );
    }
    if (db.shop.supplyStatus === "out_of_paper") {
      return reject(409, `${db.shop.name} is out of paper right now.`);
    }
    if (documents.length > db.shop.maxFilesPerOrder) {
      return reject(
        400,
        `This shop accepts up to ${db.shop.maxFilesPerOrder} files per order`,
      );
    }
    if (db.shop.paymentMode === "online" && requestedMethod === "counter") {
      return reject(400, "This shop takes online payment only");
    }
    if (db.shop.paymentMode === "counter" && requestedMethod === "online") {
      return reject(400, "This shop takes cash at the counter only");
    }

    const job = await createJob(db, {
      documents,
      customerName: typeof customerName === "string" ? customerName : null,
      customerPhone: typeof customerPhone === "string" ? customerPhone : null,
      note: typeof note === "string" ? note : null,
      paymentMethod: requestedMethod,
      source: "qr",
    });

    if (requestedMethod === "counter") {
      addEvent(
        job,
        "received",
        `${formatRupees(job.amount)} to be paid at the counter`,
      );
      release(db, job);
    }

    return { job: publicJob(job) };
  });

  if ("error" in outcome) {
    return jsonError(outcome.error.status, outcome.error.message);
  }
  return Response.json(outcome, { status: 201 });
}
