"use client";

import {
  ChevronDown,
  FileText,
  IndianRupee,
  MonitorPlay,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useDashboardData } from "@/components/dashboard-provider";
import { JobDetailSheet, type JobAction } from "@/components/job-detail-sheet";
import { PageHeader } from "@/components/page-header";
import { ShopControls } from "@/components/shop-controls";
import { StatCards } from "@/components/stat-cards";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { colorLabel, formatClock, timeAgo } from "@/lib/format";
import { formatRupees } from "@/lib/pricing";
import type { JobStatus, PrintJob } from "@/lib/types";

type Filter = "open" | "all" | JobStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Live" },
  { value: "printed", label: "Printed" },
  { value: "failed", label: "Failed" },
  { value: "all", label: "All" },
];

const TEST_JOBS = [
  { kind: "bw", label: "Black & white A4" },
  { kind: "color", label: "Colour A4" },
  { kind: "a3", label: "A3 sheet" },
  { kind: "multi", label: "Two files in one order" },
];

const OPEN: JobStatus[] = [
  "awaiting_payment",
  "awaiting_approval",
  "queued",
  "printing",
];

export default function QueuePage() {
  const { data, error, isLoading, refresh } = useDashboardData();
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const jobs = useMemo(() => data?.jobs ?? [], [data]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (filter === "open" && !OPEN.includes(job.status)) return false;
      if (filter !== "open" && filter !== "all" && job.status !== filter) return false;
      if (!needle) return true;
      return [
        job.code,
        job.customerName,
        job.customerPhone,
        ...job.documents.map((document) => document.fileName),
      ]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(needle));
    });
  }, [jobs, filter, query]);

  const selected = jobs.find((job) => job.id === selectedId) ?? null;

  async function post(
    url: string,
    body: object | null,
    messages: { success: string; failure: string },
  ) {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? messages.failure);
      toast.success(messages.success);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : messages.failure);
    } finally {
      setBusy(false);
    }
  }

  const ACTION_MESSAGES: Record<JobAction, string> = {
    approve: "Approved — the printer will pick it up",
    collect: "Marked as paid",
    retry: "Back in the queue",
    cancel: "Cancelled and the file was deleted",
  };

  const act = (job: PrintJob, action: JobAction) =>
    post(
      `/api/jobs/${job.id}`,
      { action },
      { success: ACTION_MESSAGES[action], failure: "That did not work" },
    );

  const runVirtualPrinter = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/virtual-agent", { method: "POST" });
      const payload = (await response.json()) as {
        printed: number;
        blocked: string | null;
      };
      if (payload.blocked === "auto_print_off") {
        toast.warning("Auto print is switched off");
      } else if (payload.blocked === "shop_closed") {
        toast.warning("The shop is marked closed");
      } else if (payload.printed === 0) {
        toast.info("Nothing was waiting in the queue");
      } else {
        toast.success(
          `Virtual printer finished ${payload.printed} ${payload.printed === 1 ? "job" : "jobs"} and deleted the files`,
        );
      }
      await refresh();
    } catch {
      toast.error("Could not run the virtual printer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Print queue"
        description="Every order a customer sends by scanning your QR lands here and goes straight to the printer."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={busy}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runVirtualPrinter()}
              disabled={busy}
            >
              <MonitorPlay className="size-4" />
              Virtual printer
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" disabled={busy} />}>
                <Send className="size-4" />
                Test print
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Queue a real PDF</DropdownMenuLabel>
                {TEST_JOBS.map((item) => (
                  <DropdownMenuItem
                    key={item.kind}
                    onClick={() =>
                      void post(
                        "/api/jobs/test",
                        { kind: item.kind },
                        {
                          success: `Queued a ${item.label.toLowerCase()} test`,
                          failure: "Could not queue the test",
                        },
                      )
                    }
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Lost contact with the print server</AlertTitle>
            <AlertDescription>
              {error}. Still retrying — the queue below may be a few seconds old.
            </AlertDescription>
          </Alert>
        ) : null}

        {data && !data.agentOnline ? (
          <Alert>
            <AlertTitle>Print agent is not running</AlertTitle>
            <AlertDescription>
              Nothing will print until the agent is running on the computer
              attached to your printer.{" "}
              <Link href="/qr" className="font-medium underline">
                Start the agent
              </Link>
              , or use the virtual printer above to see the flow.
            </AlertDescription>
          </Alert>
        ) : null}

        {data?.blocked === "auto_print_off" ? (
          <Alert>
            <AlertTitle>Auto print is switched off</AlertTitle>
            <AlertDescription>
              Orders keep arriving and wait in the queue. Turn it back on in{" "}
              <Link href="/settings" className="font-medium underline">
                Settings
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : null}

        <ShopControls />

        <StatCards stats={data?.stats ?? null} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
            <TabsList>
              {FILTERS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, name, or file"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingRows />
        ) : jobs.length === 0 ? (
          <EmptyQueue shopId={data?.shop.id} />
        ) : visible.length === 0 ? (
          <NoMatches
            filter={filter}
            onClear={() => {
              setFilter("all");
              setQuery("");
            }}
          />
        ) : (
          <>
            <Card className="hidden overflow-hidden py-0 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Printer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((job) => {
                    const printer = data?.printers.find(
                      (item) => item.id === job.printerId,
                    );
                    const first = job.documents[0];
                    return (
                      <TableRow
                        key={job.id}
                        onClick={() => setSelectedId(job.id)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <p className="font-medium">
                            {job.customerName ?? "Walk-in"}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {job.code}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-[18rem]">
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm">
                                {first?.fileName ?? "—"}
                                {job.documents.length > 1
                                  ? ` +${job.documents.length - 1}`
                                  : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {job.totalPages}{" "}
                                {job.totalPages === 1 ? "page" : "pages"}
                                {first
                                  ? ` · ${first.paperSize} · ${colorLabel(first.color)}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {printer?.name ?? (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          <span className="font-medium">
                            {formatRupees(job.amount)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {job.payment.status === "paid"
                              ? job.payment.method === "online"
                                ? "paid online"
                                : "cash taken"
                              : job.payment.method === "online"
                                ? "not paid"
                                : "at counter"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={job.status} />
                            {job.serverFilesDeletedAt ? (
                              <span title="File deleted after printing">
                                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap text-muted-foreground">
                          <span title={new Date(job.createdAt).toLocaleString()}>
                            {timeAgo(job.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <RowActions job={job} busy={busy} onAction={act} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            <div className="grid gap-3 md:hidden">
              {visible.map((job) => (
                <Card
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className="cursor-pointer"
                >
                  <CardContent className="space-y-2 py-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {job.customerName ?? "Walk-in"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {job.documents[0]?.fileName}
                          {job.documents.length > 1
                            ? ` +${job.documents.length - 1}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{job.code}</span>
                      <span>
                        {job.totalPages}p · {formatRupees(job.amount)} ·{" "}
                        {formatClock(job.createdAt)}
                      </span>
                    </div>
                    {job.lastError ? (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {job.lastError}
                      </p>
                    ) : null}
                    <div onClick={(event) => event.stopPropagation()}>
                      <RowActions job={job} busy={busy} onAction={act} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <JobDetailSheet
        job={selected}
        printers={data?.printers ?? []}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onAction={(job, action) => void act(job, action)}
        busy={busy}
      />
    </div>
  );
}

function RowActions({
  job,
  busy,
  onAction,
}: {
  job: PrintJob;
  busy: boolean;
  onAction: (job: PrintJob, action: JobAction) => void;
}) {
  if (job.status === "awaiting_approval") {
    return (
      <Button size="sm" disabled={busy} onClick={() => onAction(job, "approve")}>
        <ThumbsUp className="size-4" />
        Approve
      </Button>
    );
  }
  if (job.payment.status === "pending" && job.status !== "cancelled") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => onAction(job, "collect")}
      >
        <IndianRupee className="size-4" />
        Paid
      </Button>
    );
  }
  return null;
}

function LoadingRows() {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="size-8 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function EmptyQueue({ shopId }: { shopId?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted">
          <FileText className="size-5 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">No orders yet today</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Put your QR code on the counter. A customer scans it, uploads from
            their phone, pays, and the print comes out here — nobody has to press
            print.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" render={<Link href="/qr" />}>
            Get my QR code
          </Button>
          {shopId ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/print/${shopId}`} target="_blank" />}
            >
              Open the customer page
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function NoMatches({
  filter,
  onClear,
}: {
  filter: Filter;
  onClear: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-medium">
          {filter === "open"
            ? "Nothing waiting — the queue is clear"
            : "Nothing matches this view"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {filter === "open"
            ? "Every order that came in has already printed."
            : "Try a different tab, or clear the search box."}
        </p>
        <Button size="sm" variant="outline" onClick={onClear}>
          Show all orders
        </Button>
      </CardContent>
    </Card>
  );
}
