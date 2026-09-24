"use client";

import { createContext, useContext } from "react";

import { useDashboard } from "@/hooks/use-dashboard";

type DashboardContextValue = ReturnType<typeof useDashboard>;

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const value = useDashboard();
  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
}

export function useDashboardData() {
  const value = useContext(DashboardContext);
  if (!value) {
    throw new Error("useDashboardData must be used inside DashboardProvider");
  }
  return value;
}
