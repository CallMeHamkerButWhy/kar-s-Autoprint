"use client";

import { Megaphone, Store, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useDashboardData } from "@/components/dashboard-provider";
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
import { Switch } from "@/components/ui/switch";
import type { Shop, SupplyStatus } from "@/lib/types";

const SUPPLY_LABELS: Record<SupplyStatus, string> = {
  ok: "All good",
  low_ink: "Low on ink",
  out_of_paper: "Out of paper",
};

/** The switches a counter actually touches during the day. */
export function ShopControls() {
  const { data } = useDashboardData();
  if (!data?.shop) return null;
  return <Controls key={data.shop.id} shop={data.shop} />;
}

function Controls({ shop }: { shop: Shop }) {
  const { refresh } = useDashboardData();
  const [notice, setNotice] = useState(shop.notice ?? "");
  const [saving, setSaving] = useState(false);

  async function save(patch: object, message: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Could not save");
      toast.success(message);
      await refresh();
    } catch {
      toast.error("Could not save that change");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-5 py-1 lg:grid-cols-3">
        <div className="flex items-start justify-between gap-3 lg:border-r lg:pr-5">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Store className="size-4 text-muted-foreground" />
              {shop.isOpen ? "Shop is open" : "Shop is closed"}
            </Label>
            <p className="text-xs text-muted-foreground">
              {shop.isOpen
                ? "Customers can scan and send print jobs"
                : "Customers see a closed message and cannot order"}
            </p>
          </div>
          <Switch
            checked={shop.isOpen}
            disabled={saving}
            aria-label="Shop open"
            onCheckedChange={(checked) =>
              void save(
                { isOpen: checked },
                checked ? "Shop is open" : "Shop marked closed",
              )
            }
          />
        </div>

        <div className="flex items-start justify-between gap-3 lg:border-r lg:pr-5">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Zap className="size-4 text-muted-foreground" />
              Auto print
            </Label>
            <p className="text-xs text-muted-foreground">
              {shop.autoPrintEnabled
                ? "Paid jobs go to the printer on their own"
                : "Jobs wait in the queue until you turn this on"}
            </p>
          </div>
          <Switch
            checked={shop.autoPrintEnabled}
            disabled={saving}
            aria-label="Auto print"
            onCheckedChange={(checked) =>
              void save(
                { autoPrintEnabled: checked },
                checked ? "Auto print on" : "Auto print paused",
              )
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Ink and paper</Label>
          <Select
            items={SUPPLY_LABELS}
            value={shop.supplyStatus}
            disabled={saving}
            onValueChange={(value) =>
              void save({ supplyStatus: value }, "Customers will see this")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SUPPLY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 lg:col-span-3">
          <Label htmlFor="shop-notice" className="flex items-center gap-2 text-sm font-medium">
            <Megaphone className="size-4 text-muted-foreground" />
            Message for customers
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="shop-notice"
              value={notice}
              maxLength={160}
              placeholder="Aaj sirf black & white · Colour printer repair par hai"
              onChange={(event) => setNotice(event.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={saving || notice.trim() === (shop.notice ?? "")}
                onClick={() =>
                  void save({ notice: notice.trim() }, "Message is live")
                }
              >
                Show it
              </Button>
              {shop.notice ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    void save({ notice: "" }, "Message removed").then(() =>
                      setNotice(""),
                    )
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
