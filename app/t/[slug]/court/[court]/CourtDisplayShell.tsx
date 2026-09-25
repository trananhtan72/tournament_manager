"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}
const noSubscription = () => () => {};

/**
 * Full-screen frame for a court's TV/tablet: covers the site's header, keeps
 * the screen awake, and refreshes the score on a timer. The fixed overlay is
 * what hides the normal page chrome, so this route needs no layout of its own.
 */
export function CourtDisplayShell({ refreshMs, children }: { refreshMs: number; children: ReactNode }) {
  const canFullscreen = useSyncExternalStore(noSubscription, () => Boolean(document.fullscreenEnabled), () => false);
  const isFullscreen = useSyncExternalStore(subscribeFullscreen, () => Boolean(document.fullscreenElement), () => false);

  // Keep the screen from dimming or sleeping while this is up (where supported).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Not supported, or refused (e.g. low battery): the screen just behaves normally.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  return (
    <div data-court-display className="fixed inset-0 z-[100] overflow-hidden bg-black font-[family-name:var(--font-geist-sans)] text-white">
      <AutoRefresh intervalMs={refreshMs} />
      {children}
      {canFullscreen && !isFullscreen && (
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}
          className="absolute bottom-2 right-2 rounded-md px-2 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white"
        >
          Full screen
        </button>
      )}
    </div>
  );
}
