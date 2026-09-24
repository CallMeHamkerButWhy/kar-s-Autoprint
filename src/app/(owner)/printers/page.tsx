"use client";

import { Plus, Printer as PrinterIcon, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useDashboardData } from "@/components/dashboard-provider";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isPrinterOnline } from "@/lib/dashboard";
import { timeAgo } from "@/lib/format";
import { PRINTER_ROLES, type Printer, type PrinterRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function PrintersPage() {
  const { data, refresh } = useDashboardData();
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", systemName: "" });

  const printers = data?.printers ?? [];

  async function send(url: string, init: RequestInit, message: string) {
    setBusy(true);
    try {
      const response = await fetch(url, init);
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "That did not work");
      toast.success(message);
      await refresh();
      return true;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "That did not work");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const patch = (printer: Printer, body: object, message: string) =>
    send(
      `/api/printers/${printer.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      message,
    );

  const toggleRole = (printer: Printer, role: PrinterRole) => {
    const roles = printer.roles.includes(role)
      ? printer.roles.filter((item) => item !== role)
      : [...printer.roles, role];
    return patch(printer, { roles }, `${printer.name} updated`);
  };

  const addPrinter = async () => {
    const ok = await send(
      "/api/printers",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          systemName: form.systemName,
          roles: ["bw"],
        }),
      },
      "Printer added",
    );
    if (ok) {
      setAddOpen(false);
      setForm({ name: "", systemName: "" });
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Printers"
        description="Tell Auto Print which queue prints what. Black & white, colour, photo and A3 jobs each go to the printer you pick."
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" />
              Add printer
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a printer by hand</DialogTitle>
                <DialogDescription>
                  Printers usually appear on their own once the agent runs. Add one
                  here if you want it ready before that.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="printer-name">Name you will recognise</Label>
                  <Input
                    id="printer-name"
                    value={form.name}
                    placeholder="Counter laser"
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="printer-queue">Queue name on the computer</Label>
                  <Input
                    id="printer-queue"
                    value={form.systemName}
                    placeholder="HP_LaserJet_M1005"
                    onChange={(event) =>
                      setForm({ ...form, systemName: event.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Exactly as Windows or CUPS spells it. The agent prints to this
                    name.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => void addPrinter()}
                  disabled={busy || !form.name.trim() || !form.systemName.trim()}
                >
                  Add printer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {data && !data.agentOnline ? (
          <Alert>
            <AlertTitle>Printer list is not live yet</AlertTitle>
            <AlertDescription>
              When the print agent runs on your shop computer it reports every
              printer it can see, and they show up here automatically.
            </AlertDescription>
          </Alert>
        ) : null}

        {printers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-muted">
                <PrinterIcon className="size-5 text-muted-foreground" />
              </span>
              <p className="font-medium">No printers yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Start the print agent on the computer your printer is plugged into,
                or add a queue by hand.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {printers.map((printer) => {
              const online = isPrinterOnline(printer);
              return (
                <Card key={printer.id}>
                  <CardContent className="space-y-4 py-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{printer.name}</p>
                          {printer.isDefault ? (
                            <Badge variant="secondary">Default</Badge>
                          ) : null}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs",
                              online
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                online ? "bg-emerald-500" : "bg-muted-foreground/40",
                              )}
                            />
                            {online
                              ? "Reachable now"
                              : printer.lastSeenAt
                                ? `Last seen ${timeAgo(printer.lastSeenAt)}`
                                : "Never seen by the agent"}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {printer.systemName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!printer.isDefault ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label="Make default"
                            title="Make default"
                            onClick={() =>
                              void patch(
                                printer,
                                { isDefault: true },
                                `${printer.name} is now the default`,
                              )
                            }
                          >
                            <Star className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          aria-label="Remove printer"
                          onClick={() =>
                            void send(
                              `/api/printers/${printer.id}`,
                              { method: "DELETE" },
                              `${printer.name} removed`,
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase">
                        This printer handles
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {PRINTER_ROLES.map((role) => {
                          const active = printer.roles.includes(role.value);
                          return (
                            <Button
                              key={role.value}
                              size="sm"
                              variant={active ? "default" : "outline"}
                              disabled={busy}
                              onClick={() => void toggleRole(printer, role.value)}
                            >
                              {role.label}
                            </Button>
                          );
                        })}
                      </div>
                      {printer.roles.length === 0 ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Nothing is routed here yet — pick at least one job type.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Prints both sides</Label>
                        <p className="text-xs text-muted-foreground">
                          Turn on only if this printer really has duplex hardware.
                        </p>
                      </div>
                      <Switch
                        checked={printer.duplexCapable}
                        disabled={busy}
                        aria-label="Duplex capable"
                        onCheckedChange={(checked) =>
                          void patch(
                            printer,
                            { duplexCapable: checked },
                            `${printer.name} updated`,
                          )
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
