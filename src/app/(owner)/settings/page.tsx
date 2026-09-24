"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useDashboardData } from "@/components/dashboard-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatRupees } from "@/lib/pricing";
import type { PageRangeTier, PaymentMode, Shop } from "@/lib/types";

type Draft = {
  name: string;
  phone: string;
  address: string;
  paymentMode: PaymentMode;
  approvalMode: "auto" | "manual";
  maxFilesPerOrder: number;
  maxAttempts: number;
  claimTimeoutSeconds: number;
  bw: string;
  color: string;
  a3bw: string;
  a3color: string;
  a2bw: string;
  a2color: string;
  a1bw: string;
  a1color: string;
  pageRanges: { fromPages: string; bw: string; color: string }[];
};

function toDraft(shop: Shop): Draft {
  return {
    name: shop.name,
    phone: shop.phone,
    address: shop.address,
    paymentMode: shop.paymentMode,
    approvalMode: shop.approvalMode,
    maxFilesPerOrder: shop.maxFilesPerOrder,
    maxAttempts: shop.maxAttempts,
    claimTimeoutSeconds: shop.claimTimeoutSeconds,
    bw: String(shop.rates.bw),
    color: String(shop.rates.color),
    a3bw: String(shop.rates.a3.bw),
    a3color: String(shop.rates.a3.color),
    a2bw: String(shop.rates.a2.bw),
    a2color: String(shop.rates.a2.color),
    a1bw: String(shop.rates.a1.bw),
    a1color: String(shop.rates.a1.color),
    pageRanges: [0, 1, 2].map((index) => {
      const tier = shop.rates.pageRanges[index];
      return {
        fromPages: tier ? String(tier.fromPages) : "",
        bw: tier ? String(tier.bw) : "",
        color: tier ? String(tier.color) : "",
      };
    }),
  };
}

export default function SettingsPage() {
  const { data } = useDashboardData();

  if (!data?.shop) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader
          title="Settings"
          description="Shop details, print rates, and how jobs reach the printer."
        />
        <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Keyed on the shop so the form seeds itself from server state exactly once.
  return <SettingsForm key={data.shop.id} shop={data.shop} />;
}

function SettingsForm({ shop }: { shop: Shop }) {
  const { refresh } = useDashboardData();
  const [draft, setDraft] = useState<Draft>(() => toDraft(shop));
  const [saving, setSaving] = useState(false);

  async function save(patch: object, message: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error();
      toast.success(message);
      await refresh();
    } catch {
      toast.error("Could not save those settings");
    } finally {
      setSaving(false);
    }
  }

  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const num = (value: string, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  const saveRates = () => {
    const pageRanges: PageRangeTier[] = draft.pageRanges
      .filter((tier) => tier.fromPages.trim() !== "")
      .map((tier) => ({
        fromPages: num(tier.fromPages),
        bw: num(tier.bw),
        color: num(tier.color),
      }))
      .filter((tier) => tier.fromPages > 0);

    return save(
      {
        rates: {
          bw: num(draft.bw, shop.rates.bw),
          color: num(draft.color, shop.rates.color),
          a3: { bw: num(draft.a3bw), color: num(draft.a3color) },
          a2: { bw: num(draft.a2bw), color: num(draft.a2color) },
          a1: { bw: num(draft.a1bw), color: num(draft.a1color) },
          pageRanges,
        },
      },
      "Rates updated",
    );
  };

  const sampleTen = num(draft.bw) * 10;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Settings"
        description="Shop details, print rates, and how jobs reach the printer."
      />

      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Shop details</CardTitle>
            <CardDescription>
              Your customers see the name and address on the upload page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop name</Label>
              <Input
                id="shop-name"
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shop-phone">Phone</Label>
                <Input
                  id="shop-phone"
                  value={draft.phone}
                  placeholder="84048 32414"
                  onChange={(event) => update({ phone: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shop-id">Shop ID</Label>
                <Input
                  id="shop-id"
                  readOnly
                  value={shop.id}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-address">Address</Label>
              <Input
                id="shop-address"
                value={draft.address}
                placeholder="Main road, near bus stand"
                onChange={(event) => update({ address: event.target.value })}
              />
            </div>
            <Button
              disabled={saving}
              onClick={() =>
                void save(
                  {
                    name: draft.name,
                    phone: draft.phone,
                    address: draft.address,
                  },
                  "Shop details saved",
                )
              }
            >
              Save details
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
            <CardDescription>
              How customers pay, and whether you want to eyeball jobs before they
              print.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Payment</Label>
              <Select
                value={draft.paymentMode}
                onValueChange={(value) => {
                  update({ paymentMode: value as PaymentMode });
                  void save({ paymentMode: value }, "Payment mode saved");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="counter">Cash at the counter only</SelectItem>
                  <SelectItem value="online">Online payment only</SelectItem>
                  <SelectItem value="both">Both — customer chooses</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Online payment is wired to a stand-in confirm step in this build.
                Swap in Razorpay or Cashfree at{" "}
                <code className="font-mono">/api/orders/[id]/pay</code>.
              </p>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="space-y-0.5">
                <Label className="text-sm">Approve each job first</Label>
                <p className="text-xs text-muted-foreground">
                  On: nothing prints until you tap Approve. Off: paid jobs print
                  straight away.
                </p>
              </div>
              <Switch
                checked={draft.approvalMode === "manual"}
                disabled={saving}
                aria-label="Manual approval"
                onCheckedChange={(checked) => {
                  const mode = checked ? "manual" : "auto";
                  update({ approvalMode: mode });
                  void save(
                    { approvalMode: mode },
                    checked ? "Jobs will wait for approval" : "Jobs print on their own",
                  );
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-files">Files a customer may send at once</Label>
              <Input
                id="max-files"
                type="number"
                min={1}
                max={20}
                value={draft.maxFilesPerOrder}
                onChange={(event) =>
                  update({ maxFilesPerOrder: Number(event.target.value) })
                }
                onBlur={() =>
                  void save(
                    { maxFilesPerOrder: draft.maxFilesPerOrder },
                    "Upload limit saved",
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Print rates</CardTitle>
            <CardDescription>
              What the customer is charged. A {draft.bw || 0} rupee black & white
              rate makes a 10 page document {formatRupees(sampleTen)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="rate-bw">Black & white, per page</Label>
                <Input
                  id="rate-bw"
                  type="number"
                  min={0}
                  step="0.5"
                  value={draft.bw}
                  onChange={(event) => update({ bw: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate-color">Colour, per page</Label>
                <Input
                  id="rate-color"
                  type="number"
                  min={0}
                  step="0.5"
                  value={draft.color}
                  onChange={(event) => update({ color: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Bulk rates</Label>
                <p className="text-xs text-muted-foreground">
                  From this many sheets in one document, charge this instead. Leave
                  blank to skip.
                </p>
              </div>
              <div className="space-y-2">
                {draft.pageRanges.map((tier, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="From pages"
                      value={tier.fromPages}
                      onChange={(event) => {
                        const next = [...draft.pageRanges];
                        next[index] = { ...tier, fromPages: event.target.value };
                        update({ pageRanges: next });
                      }}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      placeholder="B&W rate"
                      value={tier.bw}
                      onChange={(event) => {
                        const next = [...draft.pageRanges];
                        next[index] = { ...tier, bw: event.target.value };
                        update({ pageRanges: next });
                      }}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      placeholder="Colour rate"
                      value={tier.color}
                      onChange={(event) => {
                        const next = [...draft.pageRanges];
                        next[index] = { ...tier, color: event.target.value };
                        update({ pageRanges: next });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Big paper, per page</Label>
                <p className="text-xs text-muted-foreground">
                  Set 0 and A3, A2, or A1 falls back to your normal rate.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["A3", "a3bw", "a3color"],
                    ["A2", "a2bw", "a2color"],
                    ["A1", "a1bw", "a1color"],
                  ] as const
                ).map(([label, bwKey, colorKey]) => (
                  <div key={label} className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">{label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="B&W"
                        value={draft[bwKey]}
                        onChange={(event) =>
                          update({ [bwKey]: event.target.value } as Partial<Draft>)
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Colour"
                        value={draft[colorKey]}
                        onChange={(event) =>
                          update({ [colorKey]: event.target.value } as Partial<Draft>)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button disabled={saving} onClick={() => void saveRates()}>
              Save rates
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>When a print fails</CardTitle>
            <CardDescription>
              Out of paper, printer asleep, computer restarted — these decide how
              hard Auto Print tries before it gives up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max-attempts">Tries per job</Label>
                <Input
                  id="max-attempts"
                  type="number"
                  min={1}
                  max={10}
                  value={draft.maxAttempts}
                  onChange={(event) =>
                    update({ maxAttempts: Number(event.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claim-timeout">
                  Seconds before a stuck job is retried
                </Label>
                <Input
                  id="claim-timeout"
                  type="number"
                  min={15}
                  max={3600}
                  value={draft.claimTimeoutSeconds}
                  onChange={(event) =>
                    update({ claimTimeoutSeconds: Number(event.target.value) })
                  }
                />
              </div>
            </div>
            <Button
              disabled={saving}
              onClick={() =>
                void save(
                  {
                    maxAttempts: draft.maxAttempts,
                    claimTimeoutSeconds: draft.claimTimeoutSeconds,
                  },
                  "Retry settings saved",
                )
              }
            >
              Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
