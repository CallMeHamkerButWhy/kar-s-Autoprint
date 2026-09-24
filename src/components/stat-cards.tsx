import { IndianRupee, Printer, Timer, TriangleAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/format";
import { formatRupees } from "@/lib/pricing";
import type { DashboardStats } from "@/lib/dashboard";

export function StatCards({ stats }: { stats: DashboardStats | null }) {
  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent className="space-y-3 py-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Waiting to print",
      value: stats.waiting + stats.printing,
      hint:
        stats.printing > 0
          ? `${stats.printing} on the printer now`
          : stats.awaitingApproval > 0
            ? `${stats.awaitingApproval} need approval first`
            : "Queue is clear",
      icon: Timer,
      tone: "text-slate-500",
    },
    {
      label: "Prints today",
      value: stats.printsToday,
      hint: `${stats.pagesToday} ${stats.pagesToday === 1 ? "page" : "pages"} today`,
      icon: Printer,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Earned today",
      value: formatRupees(stats.earningsToday),
      hint:
        stats.earningsPending > 0
          ? `${formatRupees(stats.earningsPending)} still to collect`
          : "Nothing pending at the counter",
      icon: IndianRupee,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Needs attention",
      value: stats.failed,
      hint:
        stats.failed > 0
          ? "Open the job to see the printer error"
          : stats.successRate == null
            ? "No prints yet"
            : `${stats.successRate}% success · median ${formatDuration(stats.medianSecondsToPrint)}`,
      icon: TriangleAlert,
      tone:
        stats.failed > 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="py-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {card.label}
              </p>
              <card.icon className={`size-4 ${card.tone}`} />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
