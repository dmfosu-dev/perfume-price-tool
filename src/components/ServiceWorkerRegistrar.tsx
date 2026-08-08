"use client";

import { useEffect } from "react";

/// Registers the offline cache. Renders nothing.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registration failing is not fatal — the app simply has no offline cache.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
