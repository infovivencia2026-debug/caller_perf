"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically re-fetches the current route's server data so changes made elsewhere (a
 * counsellor logging a call, an admin assigning leads) show up without a manual reload.
 * Uses router.refresh(), which swaps the server-rendered data in place and preserves
 * client state and uncontrolled inputs (typed drafts, ticked checkboxes) across refreshes.
 * Pauses while the tab is hidden to avoid needless load.
 */
export function AutoRefresh({ intervalMs = 12000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    // Refresh immediately when the tab regains focus, so a returning user sees current data.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
