import {
  Ban,
  Check,
  Clock,
  IndianRupee,
  Loader2,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";

import { STATUS_LABELS } from "@/lib/format";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<JobStatus, string> = {
  awaiting_payment:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  awaiting_approval:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  queued:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  printing:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  printed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  failed:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  cancelled:
    "border-slate-200 bg-transparent text-muted-foreground dark:border-slate-700",
};

const ICONS: Record<JobStatus, React.ComponentType<{ className?: string }>> = {
  awaiting_payment: IndianRupee,
  awaiting_approval: ThumbsUp,
  queued: Clock,
  printing: Loader2,
  printed: Check,
  failed: TriangleAlert,
  cancelled: Ban,
};

export function StatusBadge({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  const Icon = ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status],
        className,
      )}
    >
      <Icon className={cn("size-3", status === "printing" && "animate-spin")} />
      {STATUS_LABELS[status]}
    </span>
  );
}
