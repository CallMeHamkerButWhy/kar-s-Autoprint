import { AppShell } from "@/components/app-shell";
import { DashboardProvider } from "@/components/dashboard-provider";

/** The shop owner's side of the product: queue, printers, QR, settings. */
export default function OwnerLayout({ children }: LayoutProps<"/">) {
  return (
    <DashboardProvider>
      <AppShell>{children}</AppShell>
    </DashboardProvider>
  );
}
