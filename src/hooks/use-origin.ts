"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * The page's own origin, read the way React wants client-only values read, so
 * server and client renders agree and nothing flashes.
 */
export function useOrigin() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
