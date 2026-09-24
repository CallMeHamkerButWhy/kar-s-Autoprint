"use client";

import {
  AlertCircle,
  Banknote,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { countPagesInBrowser } from "@/lib/count-pages-client";
import { formatBytes } from "@/lib/format";
import { formatRupees, priceDocument, sheetsFor } from "@/lib/pricing";
import type { PublicShop } from "@/lib/public-shop";
import type { ColorMode, PaperSize } from "@/lib/types";

interface Pick {
  key: string;
  file: File;
  pages: number;
  copies: number;
  color: ColorMode;
  paperSize: PaperSize;
  duplex: boolean;
}

const BASE_SIZES: PaperSize[] = ["A4", "A5", "Legal"];
const BIG_SIZES: PaperSize[] = ["A3", "A2", "A1"];
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*";

export function OrderFlow({ shopId }: { shopId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [shop, setShop] = useState<PublicShop | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"counter" | "online">("counter");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/shop/${shopId}`, { cache: "no-store" });
        const payload = (await response.json()) as {
          shop?: PublicShop;
          error?: string;
        };
        if (!response.ok || !payload.shop) {
          throw new Error(payload.error ?? "Could not load this shop");
        }
        if (cancelled) return;
        setShop(payload.shop);
        setMethod(payload.shop.paymentMode === "online" ? "online" : "counter");
      } catch (cause) {
        if (!cancelled) {
          setLoadError(
            cause instanceof Error ? cause.message : "Could not load this shop",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !shop) return;

    const room = shop.maxFilesPerOrder - picks.length;
    const chosen = Array.from(files).slice(0, Math.max(room, 0));
    if (chosen.length === 0) {
      setSubmitError(`You can send up to ${shop.maxFilesPerOrder} files in one order`);
      return;
    }

    const added: Pick[] = [];
    for (const file of chosen) {
      added.push({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        pages: await countPagesInBrowser(file),
        copies: 1,
        color: shop.colorEnabled ? "bw" : "bw",
        paperSize: "A4",
        duplex: false,
      });
    }
    setPicks((current) => [...current, ...added]);
    setSubmitError(null);
  };

  const update = (key: string, patch: Partial<Pick>) =>
    setPicks((current) =>
      current.map((pick) => (pick.key === key ? { ...pick, ...patch } : pick)),
    );

  const remove = (key: string) =>
    setPicks((current) => current.filter((pick) => pick.key !== key));

  const quotes = shop
    ? picks.map((pick) => priceDocument(shop.rates, pick))
    : [];
  const total = quotes.reduce((sum, quote) => sum + quote.amount, 0);
  const sheets = picks.reduce(
    (sum, pick) => sum + sheetsFor(pick.pages, pick.copies, pick.duplex),
    0,
  );

  const submit = async () => {
    if (!shop || picks.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const form = new FormData();
      for (const pick of picks) form.append("file", pick.file, pick.file.name);
      form.append(
        "options",
        JSON.stringify(
          picks.map((pick) => ({
            copies: pick.copies,
            color: pick.color,
            paperSize: pick.paperSize,
            duplex: pick.duplex,
            pages: pick.pages,
          })),
        ),
      );
      form.append("paymentMethod", method);
      if (name.trim()) form.append("customerName", name.trim());
      if (phone.trim()) form.append("customerPhone", phone.trim());

      const response = await fetch(`/api/shop/${shopId}/orders`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        job?: { id: string };
        error?: string;
      };
      if (!response.ok || !payload.job) {
        throw new Error(payload.error ?? "Could not send the order");
      }

      router.push(`/print/${shopId}/orders/${payload.job.id}`);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : "Could not send the order",
      );
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>This QR did not work</AlertTitle>
          <AlertDescription>
            {loadError}. Please ask the shop to show you their current QR code.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const paperSizes = shop.bigPaperEnabled
    ? [...BASE_SIZES, ...BIG_SIZES]
    : BASE_SIZES;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6 pb-28">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{shop.name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {shop.address || "Print shop"}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Send your files from here. The print comes out at the counter — no
          WhatsApp, no pen drive.
        </p>
      </header>

      {!shop.isOpen ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>The shop is closed right now</AlertTitle>
          <AlertDescription>
            You can come back when it reopens, or call{" "}
            {shop.phone || "the shop"} to check.
          </AlertDescription>
        </Alert>
      ) : null}

      {shop.supplyStatus !== "ok" ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>
            {shop.supplyStatus === "out_of_paper"
              ? "The shop is out of paper"
              : "The shop is low on ink"}
          </AlertTitle>
          <AlertDescription>
            {shop.supplyStatus === "out_of_paper"
              ? "New orders cannot print until paper is loaded."
              : "Colour prints may come out light for a while."}
          </AlertDescription>
        </Alert>
      ) : null}

      {shop.notice ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">From the shop: </span>
          {shop.notice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border px-2.5 py-1">
          B&W {formatRupees(shop.rates.bw)}/page
        </span>
        <span className="rounded-full border px-2.5 py-1">
          Colour {formatRupees(shop.rates.color)}/page
        </span>
        <span className="rounded-full border px-2.5 py-1">
          Up to {shop.maxFilesPerOrder} files
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          void addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {picks.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!shop.isOpen}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60"
        >
          <span className="grid size-12 place-items-center rounded-full bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </span>
          <span className="font-medium">Choose your files</span>
          <span className="text-xs text-muted-foreground">
            PDF, JPG, PNG or WEBP · up to 25 MB each
          </span>
        </button>
      ) : (
        <div className="space-y-3">
          {picks.map((pick, index) => (
            <Card key={pick.key}>
              <CardContent className="space-y-3 py-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{pick.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pick.pages} {pick.pages === 1 ? "page" : "pages"} ·{" "}
                      {formatBytes(pick.file.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatRupees(quotes[index]?.amount ?? 0)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove file"
                      onClick={() => remove(pick.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Copies</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      inputMode="numeric"
                      value={pick.copies}
                      onChange={(event) =>
                        update(pick.key, {
                          copies: Math.min(
                            50,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Print</Label>
                    <Select
                      value={pick.color}
                      onValueChange={(value) =>
                        update(pick.key, { color: value as ColorMode })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bw">Black & white</SelectItem>
                        <SelectItem value="color" disabled={!shop.colorEnabled}>
                          Colour
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Paper</Label>
                    <Select
                      value={pick.paperSize}
                      onValueChange={(value) =>
                        update(pick.key, { paperSize: value as PaperSize })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paperSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {shop.duplexEnabled && pick.pages > 1 ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <Label className="text-xs">
                      Print on both sides (saves paper)
                    </Label>
                    <Switch
                      checked={pick.duplex}
                      aria-label="Both sides"
                      onCheckedChange={(checked) =>
                        update(pick.key, { duplex: checked })
                      }
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}

          {picks.length < shop.maxFilesPerOrder ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => inputRef.current?.click()}
            >
              <Plus className="size-4" />
              Add another file
            </Button>
          ) : null}
        </div>
      )}

      {picks.length > 0 ? (
        <>
          <Card>
            <CardContent className="space-y-3 py-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="customer-name" className="text-xs">
                    Your name
                  </Label>
                  <Input
                    id="customer-name"
                    value={name}
                    placeholder="So the counter can call you"
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-phone" className="text-xs">
                    Phone (optional)
                  </Label>
                  <Input
                    id="customer-phone"
                    value={phone}
                    inputMode="tel"
                    maxLength={15}
                    placeholder="10 digit number"
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
              </div>

              {shop.paymentMode === "both" ? (
                <div className="space-y-2">
                  <Label className="text-xs">How will you pay?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={method === "counter" ? "default" : "outline"}
                      onClick={() => setMethod("counter")}
                    >
                      <Banknote className="size-4" />
                      At the counter
                    </Button>
                    <Button
                      variant={method === "online" ? "default" : "outline"}
                      onClick={() => setMethod("online")}
                    >
                      <Smartphone className="size-4" />
                      Pay online
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {shop.paymentMode === "online"
                    ? "This shop takes online payment only."
                    : "Pay cash at the counter when you collect your prints."}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>
              Your file is deleted as soon as it prints — from the shop computer
              and from the server. You can watch both steps on the next screen.
            </p>
          </div>
        </>
      ) : null}

      {submitError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not send</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      {picks.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold tabular-nums">
                {formatRupees(total)}
              </p>
              <p className="text-xs text-muted-foreground">
                {sheets} {sheets === 1 ? "sheet" : "sheets"} ·{" "}
                {picks.length} {picks.length === 1 ? "file" : "files"}
              </p>
            </div>
            <Button
              size="lg"
              disabled={submitting || !shop.isOpen}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : method === "online" ? (
                "Pay and print"
              ) : (
                "Send to printer"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
