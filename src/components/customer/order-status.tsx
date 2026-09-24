"use client";

import {
  AlertCircle,
  Check,
  Loader2,
  Printer,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { colorLabel, formatDateTime } from "@/lib/format";
import { formatRupees } from "@/lib/pricing";
import type { PublicJob } from "@/lib/public-shop";

const POLL_MS = 2000;

interface Step {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

export function OrderStatus({
  shopId,
  orderId,
}: {
  shopId: string;
  orderId: string;
}) {
  const [order, setOrder] = useState<PublicJob | null>(null);
  const [shopName, setShopName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          order?: PublicJob;
          shopName?: string;
          error?: string;
        };
        if (!response.ok || !payload.order) {
          throw new Error(payload.error ?? "Could not find this order");
        }
        setOrder(payload.order);
        setShopName(payload.shopName ?? "");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Something went wrong");
      } finally {
        inFlight.current = false;
      }
    };

    void load();
    timer = setInterval(() => void load(), POLL_MS);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [orderId]);

  const pay = async () => {
    setPaying(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/pay`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        order?: PublicJob;
        error?: string;
      };
      if (!response.ok || !payload.order) {
        throw new Error(payload.error ?? "Payment did not go through");
      }
      setOrder(payload.order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment did not go through");
    } finally {
      setPaying(false);
    }
  };

  if (error && !order) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Order not found</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          render={<Link href={`/print/${shopId}`} />}
        >
          Start again
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const paid = order.payment.status === "paid";
  const printing = order.status === "printing";
  const printed = order.status === "printed";
  const failed = order.status === "failed";
  const needsPayment = order.status === "awaiting_payment";

  const steps: Step[] = [
    {
      key: "uploaded",
      label: "Files received",
      done: true,
      active: false,
      icon: Check,
    },
    {
      key: "paid",
      label:
        order.payment.method === "online"
          ? "Payment done"
          : "Pay at the counter",
      done: paid,
      active: needsPayment,
      icon: Smartphone,
    },
    {
      key: "printing",
      label: printed ? "Printed" : printing ? "Printing now" : "Waiting for the printer",
      done: printed,
      active: printing || order.status === "queued" || order.status === "awaiting_approval",
      icon: Printer,
    },
    {
      key: "deleted",
      label: "File deleted from server and shop computer",
      done: order.serverFilesDeletedAt != null,
      active: printed && order.serverFilesDeletedAt == null,
      icon: Trash2,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground">{shopName}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">Order {order.code}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Show this code at the counter to collect your prints.
        </p>
      </header>

      {failed ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>The print did not go through</AlertTitle>
          <AlertDescription>
            {order.lastError ?? "The shop's printer reported a problem."} Please
            speak to the counter — you have not lost your order.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="py-1">
          <ol className="space-y-4">
            {steps.map((step) => (
              <li key={step.key} className="flex items-start gap-3">
                <span
                  className={
                    step.done
                      ? "grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"
                      : step.active
                        ? "grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                        : "grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  }
                >
                  {step.done ? (
                    <Check className="size-4" />
                  ) : step.active ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <step.icon className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <p
                    className={
                      step.done || step.active
                        ? "text-sm font-medium"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {step.label}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {needsPayment ? (
        <Card>
          <CardContent className="space-y-3 py-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Amount to pay</span>
              <span className="text-xl font-semibold tabular-nums">
                {formatRupees(order.amount)}
              </span>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={paying}
              onClick={() => void pay()}
            >
              {paying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Confirming…
                </>
              ) : (
                `Pay ${formatRupees(order.amount)} now`
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Demo build: this confirms the payment without a real gateway. Wiring
              Razorpay or Cashfree in its place does not change anything else.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-2 py-1">
          {order.documents.map((document) => (
            <div
              key={document.id}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{document.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {document.pages} {document.pages === 1 ? "page" : "pages"} ×{" "}
                  {document.copies} · {document.paperSize} ·{" "}
                  {colorLabel(document.color)}
                  {document.stored ? "" : " · file deleted"}
                </p>
              </div>
              <span className="tabular-nums">{formatRupees(document.amount)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t pt-2 text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatRupees(order.amount)}</span>
          </div>
        </CardContent>
      </Card>

      {order.serverFilesDeletedAt ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Nothing was kept</p>
            <p className="text-xs">
              Deleted {formatDateTime(order.serverFilesDeletedAt)}
              {order.agentFilesDeletedAt
                ? ", and the shop computer confirmed its copy is gone too."
                : "."}
            </p>
          </div>
        </div>
      ) : null}

      <details className="rounded-lg border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          Everything that happened
        </summary>
        <ol className="mt-3 space-y-3">
          {[...order.events].reverse().map((event, index) => (
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
      </details>

      <Button
        variant="outline"
        className="w-full"
        render={<Link href={`/print/${shopId}`} />}
      >
        Send more files
      </Button>
    </div>
  );
}
