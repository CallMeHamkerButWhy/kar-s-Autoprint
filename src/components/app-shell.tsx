"use client";

import {
  Menu,
  Printer as PrinterIcon,
  QrCode,
  Settings as SettingsIcon,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useDashboardData } from "@/components/dashboard-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Print queue", icon: Layers },
  { href: "/printers", label: "Printers", icon: PrinterIcon },
  { href: "/qr", label: "QR & agent", icon: QrCode },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function Brand() {
  const { data } = useDashboardData();
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <PrinterIcon className="size-5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">
          {data?.shop.name ?? "Kar's Autoprint"}
        </span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {data?.shop.id ?? "Shop panel"}
        </span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data } = useDashboardData();

  const pendingOnQueue = data
    ? data.stats.waiting +
      data.stats.printing +
      data.stats.awaitingApproval +
      data.stats.awaitingPayment
    : 0;

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const count = item.href === "/" ? pendingOnQueue : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {count > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {count}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AgentStatus() {
  const { data, error } = useDashboardData();

  if (error) {
    return (
      <span className="flex items-center gap-2 text-xs text-destructive">
        <span className="size-2 rounded-full bg-destructive" />
        Server unreachable
      </span>
    );
  }
  if (!data) {
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-muted-foreground/50" />
        Connecting…
      </span>
    );
  }
  if (!data.agentOnline) {
    return (
      <Link href="/qr" className="flex items-center gap-2 text-xs text-amber-600 hover:underline dark:text-amber-400">
        <span className="size-2 rounded-full bg-amber-500" />
        Print agent offline
      </Link>
    );
  }
  if (data.blocked) {
    return (
      <span className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <span className="size-2 rounded-full bg-amber-500" />
        {data.blocked === "shop_closed" ? "Shop closed" : "Auto print off"}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
      <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
      Agent online{data.agentVersion ? ` · v${data.agentVersion}` : ""}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r bg-card px-4 py-5 lg:flex">
        <div className="flex flex-col gap-7">
          <Brand />
          <NavLinks />
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <AgentStatus />
          <ThemeToggle />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={<Button variant="outline" size="icon" aria-label="Open menu" />}
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-5">
              <SheetHeader className="p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-2 flex flex-col gap-6">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
                <AgentStatus />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
