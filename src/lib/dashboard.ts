import type { Database, PrintJob, Printer, Shop } from "@/lib/types";

export const AGENT_ONLINE_WINDOW_MS = 90_000;

export interface DashboardStats {
  waiting: number;
  printing: number;
  awaitingPayment: number;
  awaitingApproval: number;
  failed: number;
  printsToday: number;
  pagesToday: number;
  earningsToday: number;
  earningsPending: number;
  earningsTotal: number;
  printersOnline: number;
  printersTotal: number;
  medianSecondsToPrint: number | null;
  successRate: number | null;
}

export interface DashboardPayload {
  shop: Shop;
  printers: Printer[];
  jobs: PrintJob[];
  stats: DashboardStats;
  agentOnline: boolean;
  agentVersion: string | null;
  blocked: null | "auto_print_off" | "shop_closed" | "no_printer";
  serverTime: string;
}

export function isPrinterOnline(printer: Printer, now = Date.now()) {
  if (!printer.lastSeenAt) return false;
  return now - new Date(printer.lastSeenAt).getTime() < AGENT_ONLINE_WINDOW_MS;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function buildStats(db: Database): DashboardStats {
  const now = Date.now();
  const midnight = startOfToday();

  const printedToday = db.jobs.filter(
    (job) => job.printedAt && new Date(job.printedAt).getTime() >= midnight,
  );
  const finished = db.jobs.filter(
    (job) => job.status === "printed" || job.status === "failed",
  );

  const durations = db.jobs
    .filter((job) => job.printedAt)
    .map(
      (job) =>
        (new Date(job.printedAt as string).getTime() -
          new Date(job.createdAt).getTime()) /
        1000,
    )
    .filter((seconds) => seconds >= 0)
    .sort((a, b) => a - b);

  const paid = db.jobs.filter((job) => job.payment.status === "paid");

  return {
    waiting: db.jobs.filter((job) => job.status === "queued").length,
    printing: db.jobs.filter((job) => job.status === "printing").length,
    awaitingPayment: db.jobs.filter((job) => job.status === "awaiting_payment").length,
    awaitingApproval: db.jobs.filter((job) => job.status === "awaiting_approval")
      .length,
    failed: db.jobs.filter((job) => job.status === "failed").length,
    printsToday: printedToday.length,
    pagesToday: printedToday.reduce((total, job) => total + job.totalPages, 0),
    earningsToday: paid
      .filter(
        (job) => job.payment.paidAt && new Date(job.payment.paidAt).getTime() >= midnight,
      )
      .reduce((total, job) => total + job.amount, 0),
    earningsPending: db.jobs
      .filter(
        (job) =>
          job.payment.status === "pending" &&
          job.status !== "cancelled" &&
          job.status !== "failed",
      )
      .reduce((total, job) => total + job.amount, 0),
    earningsTotal: paid.reduce((total, job) => total + job.amount, 0),
    printersOnline: db.printers.filter((printer) => isPrinterOnline(printer, now))
      .length,
    printersTotal: db.printers.length,
    medianSecondsToPrint:
      durations.length === 0
        ? null
        : Math.round(durations[Math.floor(durations.length / 2)]),
    successRate:
      finished.length === 0
        ? null
        : Math.round(
            (finished.filter((job) => job.status === "printed").length /
              finished.length) *
              100,
          ),
  };
}

export function buildDashboard(db: Database): DashboardPayload {
  const now = Date.now();
  const online = db.printers.filter((printer) => isPrinterOnline(printer, now));
  const stats = buildStats(db);

  const blocked = !db.shop.autoPrintEnabled
    ? ("auto_print_off" as const)
    : !db.shop.isOpen
      ? ("shop_closed" as const)
      : db.printers.length === 0
        ? ("no_printer" as const)
        : null;

  return {
    shop: db.shop,
    printers: db.printers,
    jobs: db.jobs.slice(0, 150),
    stats,
    agentOnline: online.length > 0,
    agentVersion: online[0]?.agentVersion ?? null,
    blocked,
    serverTime: new Date().toISOString(),
  };
}
