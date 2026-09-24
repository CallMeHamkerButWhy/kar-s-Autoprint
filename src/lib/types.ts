export type JobStatus =
  | "awaiting_payment"
  | "awaiting_approval"
  | "queued"
  | "printing"
  | "printed"
  | "failed"
  | "cancelled";

/** Paper the shop can put through a printer. */
export type PaperSize = "A4" | "A5" | "Letter" | "Legal" | "A3" | "A2" | "A1";

export type ColorMode = "bw" | "color";

export type PrinterRole = "bw" | "color" | "photo" | "a3";

export type PaymentMode = "counter" | "online" | "both";

export type PaymentMethod = "counter" | "online";

export type PaymentStatus = "pending" | "paid";

export type SupplyStatus = "ok" | "low_ink" | "out_of_paper";

/** Manual approval mirrors the agent's "approval mode" for cash counters. */
export type ApprovalMode = "auto" | "manual";

export type JobEventType =
  | "received"
  | "paid"
  | "approved"
  | "routed"
  | "claimed"
  | "printed"
  | "failed"
  | "retried"
  | "cancelled"
  | "file_deleted";

export interface JobEvent {
  at: string;
  type: JobEventType;
  message: string;
}

export interface JobDocument {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  /** Pages counted from the PDF, or 1 for an image. */
  pages: number;
  copies: number;
  color: ColorMode;
  paperSize: PaperSize;
  duplex: boolean;
  /** File on disk, cleared the moment the print finishes. */
  storedFile: string | null;
  amount: number;
  printedAt: string | null;
  error: string | null;
}

export interface PrintJob {
  id: string;
  /** Short code the customer and the counter both read out. */
  code: string;
  shopId: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  documents: JobDocument[];
  totalPages: number;
  amount: number;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    /** Mock reference until a real gateway is wired in. */
    reference: string | null;
    paidAt: string | null;
  };
  printerId: string | null;
  attempts: number;
  lastError: string | null;
  claimedAt: string | null;
  printedAt: string | null;
  /** Set once the server copy is gone — the privacy promise, recorded. */
  serverFilesDeletedAt: string | null;
  /** Set when the agent confirms the shop PC copy is gone. */
  agentFilesDeletedAt: string | null;
  source: "qr" | "dashboard" | "api";
  events: JobEvent[];
}

export interface Printer {
  id: string;
  name: string;
  /** Exact queue name the OS print command expects. */
  systemName: string;
  roles: PrinterRole[];
  duplexCapable: boolean;
  paperSizes: PaperSize[];
  isDefault: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  agentVersion: string | null;
  /** Reported by the agent, so the shop owner knows it is really reachable. */
  reportedByAgent: boolean;
}

export interface PageRangeTier {
  /** Applies when the sheet count for a document is at least this many. */
  fromPages: number;
  bw: number;
  color: number;
}

export interface Rates {
  bw: number;
  color: number;
  /** Big paper costs more; 0 means "use the normal rate". */
  a3: { bw: number; color: number };
  a2: { bw: number; color: number };
  a1: { bw: number; color: number };
  /** Volume pricing, cheapest tier wins for big documents. */
  pageRanges: PageRangeTier[];
}

export interface Shop {
  id: string;
  name: string;
  phone: string;
  address: string;
  isOpen: boolean;
  supplyStatus: SupplyStatus;
  /** Free-text line shown to customers on the upload page. */
  notice: string | null;
  rates: Rates;
  paymentMode: PaymentMode;
  approvalMode: ApprovalMode;
  autoPrintEnabled: boolean;
  maxAttempts: number;
  claimTimeoutSeconds: number;
  /** Customers cannot upload more than this in one order. */
  maxFilesPerOrder: number;
  agentToken: string;
  apiKey: string;
  createdAt: string;
}

export interface Database {
  shop: Shop;
  printers: Printer[];
  jobs: PrintJob[];
}

export const PAPER_SIZES: PaperSize[] = [
  "A4",
  "A5",
  "Letter",
  "Legal",
  "A3",
  "A2",
  "A1",
];

export const PRINTER_ROLES: { value: PrinterRole; label: string }[] = [
  { value: "bw", label: "Black & white" },
  { value: "color", label: "Colour" },
  { value: "photo", label: "4×6 photo" },
  { value: "a3", label: "A3 and bigger" },
];

export const SUPPLY_LABELS: Record<SupplyStatus, string> = {
  ok: "All good",
  low_ink: "Low on ink",
  out_of_paper: "Out of paper",
};

/** Statuses that still need something to happen before paper comes out. */
export const OPEN_STATUSES: JobStatus[] = [
  "awaiting_payment",
  "awaiting_approval",
  "queued",
  "printing",
];
