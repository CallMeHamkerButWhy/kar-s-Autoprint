"use client";

import {
  ExternalLink,
  IndianRupee,
  RotateCcw,
  ShieldCheck,
  ThumbsUp,
  XCircle,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { colorLabel, formatBytes, formatDateTime } from "@/lib/format";
import { formatRupees } from "@/lib/pricing";
import type { PrintJob, Printer } from "@/lib/types";

export type JobAction = "approve" | "collect" | "retry" | "cancel";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-all">{value}</span>
    </div>
  );
}

export function JobDetailSheet({
  job,
  printers,
  onOpenChange,
  onAction,
  busy,
}: {
  job: PrintJob | null;
  printers: Printer[];
  onOpenChange: (open: boolean) => void;
  onAction: (job: PrintJob, action: JobAction) => void;
  busy: boolean;
}) {
  const printer = printers.find((item) => item.id === job?.printerId);
  const filesGone = job?.serverFilesDeletedAt != null;

  return (
    <Sheet open={job != null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {job ? (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={job.status} />
                <span className="font-mono text-xs text-muted-foreground">
                  {job.code}
                </span>
              </div>
              <SheetTitle className="text-left leading-snug">
                {job.customerName ?? "Walk-in customer"} ·{" "}
                {formatRupees(job.amount)}
              </SheetTitle>
              <SheetDescription className="text-left">
                {job.documents.length}{" "}
                {job.documents.length === 1 ? "file" : "files"} ·{" "}
                {job.totalPages} {job.totalPages === 1 ? "page" : "pages"} ·
                received {formatDateTime(job.createdAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              {job.lastError ? (
                <Alert variant="destructive">
                  <AlertTitle>Printer said</AlertTitle>
                  <AlertDescription>{job.lastError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {job.status === "awaiting_approval" ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onAction(job, "approve")}
                  >
                    <ThumbsUp className="size-4" />
                    Approve and print
                  </Button>
                ) : null}
                {job.payment.status === "pending" && job.status !== "cancelled" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onAction(job, "collect")}
                  >
                    <IndianRupee className="size-4" />
                    Cash collected
                  </Button>
                ) : null}
                {["failed", "cancelled", "printed"].includes(job.status) &&
                !filesGone ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onAction(job, "retry")}
                  >
                    <RotateCcw className="size-4" />
                    Print again
                  </Button>
                ) : null}
                {!["printed", "cancelled"].includes(job.status) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onAction(job, "cancel")}
                  >
                    <XCircle className="size-4" />
                    Cancel
                  </Button>
                ) : null}
              </div>

              {filesGone ? (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Files deleted</p>
                    <p className="text-xs">
                      Server copy removed{" "}
                      {formatDateTime(job.serverFilesDeletedAt as string)}
                      {job.agentFilesDeletedAt
                        ? "; the shop computer confirmed its copy is gone too"
                        : "; waiting for the shop computer to confirm"}
                      .
                    </p>
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Files</h3>
                <ul className="space-y-2">
                  {job.documents.map((document) => (
                    <li
                      key={document.id}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate font-medium">
                          {document.fileName}
                        </p>
                        <span className="tabular-nums">
                          {formatRupees(document.amount)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {document.pages}{" "}
                        {document.pages === 1 ? "page" : "pages"} ×{" "}
                        {document.copies}{" "}
                        {document.copies === 1 ? "copy" : "copies"} ·{" "}
                        {document.paperSize} · {colorLabel(document.color)}
                        {document.duplex ? " · both sides" : ""} ·{" "}
                        {formatBytes(document.byteSize)}
                      </p>
                      {document.storedFile ? (
                        <a
                          href={`/api/jobs/${job.id}/documents/${document.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          Open file
                        </a>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          File deleted after printing
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border px-3 py-1">
                <Row label="Printer" value={printer?.name ?? "Not assigned"} />
                <Separator />
                <Row
                  label="Payment"
                  value={`${job.payment.method === "online" ? "Online" : "Counter"} · ${
                    job.payment.status === "paid" ? "paid" : "pending"
                  }`}
                />
                <Separator />
                <Row label="Reference" value={job.payment.reference ?? "—"} />
                <Separator />
                <Row label="Phone" value={job.customerPhone ?? "—"} />
                <Separator />
                <Row label="Tries" value={job.attempts} />
                {job.note ? (
                  <>
                    <Separator />
                    <Row label="Note" value={job.note} />
                  </>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">What happened</h3>
                <ol className="space-y-3">
                  {[...job.events].reverse().map((event, index) => (
                    <li key={`${event.at}-${index}`} className="flex gap-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-border ring-4 ring-background" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{event.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(event.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
