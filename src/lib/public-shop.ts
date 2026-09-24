import type { Database, JobDocument, PrintJob, Shop } from "@/lib/types";

/** What the customer's phone is allowed to know about the shop. */
export function publicShop(db: Database) {
  const shop: Shop = db.shop;
  return {
    id: shop.id,
    name: shop.name,
    address: shop.address,
    phone: shop.phone,
    isOpen: shop.isOpen,
    supplyStatus: shop.supplyStatus,
    notice: shop.notice,
    paymentMode: shop.paymentMode,
    maxFilesPerOrder: shop.maxFilesPerOrder,
    rates: shop.rates,
    bigPaperEnabled: db.printers.some((printer) => printer.roles.includes("a3")),
    colorEnabled: db.printers.some((printer) => printer.roles.includes("color")),
    duplexEnabled: db.printers.some((printer) => printer.duplexCapable),
  };
}

export type PublicShop = ReturnType<typeof publicShop>;

function publicDocument(document: JobDocument) {
  return {
    id: document.id,
    fileName: document.fileName,
    pages: document.pages,
    copies: document.copies,
    color: document.color,
    paperSize: document.paperSize,
    duplex: document.duplex,
    amount: document.amount,
    printedAt: document.printedAt,
    /** The customer sees the file is gone, not where it used to live. */
    stored: document.storedFile != null,
  };
}

/** Order status as the customer's phone sees it while they wait at the counter. */
export function publicJob(job: PrintJob) {
  return {
    id: job.id,
    code: job.code,
    status: job.status,
    amount: job.amount,
    totalPages: job.totalPages,
    payment: {
      method: job.payment.method,
      status: job.payment.status,
    },
    documents: job.documents.map(publicDocument),
    createdAt: job.createdAt,
    printedAt: job.printedAt,
    serverFilesDeletedAt: job.serverFilesDeletedAt,
    agentFilesDeletedAt: job.agentFilesDeletedAt,
    lastError: job.lastError,
    events: job.events.map((event) => ({
      at: event.at,
      type: event.type,
      message: event.message,
    })),
  };
}

export type PublicJob = ReturnType<typeof publicJob>;
