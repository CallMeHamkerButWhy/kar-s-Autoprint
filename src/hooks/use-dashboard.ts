"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DashboardPayload } from "@/lib/dashboard";

const POLL_MS = 2500;

/**
 * Single source of truth for the shop owner's screens. Polls while the tab is
 * visible so a queue on the counter stays current without a socket server.
 */
export function useDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      setData((await response.json()) as DashboardPayload);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the server");
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval == null) interval = setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => {
      if (interval != null) {
        clearInterval(interval);
        interval = null;
      }
    };

    // The first load runs as a task rather than inline, so mounting the tree
    // never waits on the network.
    const initial = setTimeout(() => void refresh(), 0);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(initial);
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return { data, error, isLoading, refresh };
}
