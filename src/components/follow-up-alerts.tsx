"use client";

import { useEffect, useRef } from "react";

type Due = { id: string; name: string; dueAt: string };

const STORAGE_KEY = "fu-alerted";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Watches the caller's pending follow-ups and, the moment one comes due, plays a short
 * beep and (if permitted) shows a browser notification — so callbacks aren't missed. Each
 * follow-up alerts once per day; alerted ids are remembered in localStorage so a page
 * auto-refresh doesn't re-fire them. Entirely client-side and best-effort.
 */
export function FollowUpAlerts({ items }: { items: Due[] }) {
  const alerted = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Restore today's already-alerted ids.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { date: string; ids: string[] };
        if (saved.date === todayKey()) alerted.current = new Set(saved.ids);
      }
    } catch {
      /* ignore */
    }

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const persist = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), ids: [...alerted.current] }));
      } catch {
        /* ignore */
      }
    };

    const beep = () => {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
        osc.onended = () => ctx.close().catch(() => {});
      } catch {
        /* audio blocked until a user gesture — the notification still shows */
      }
    };

    const check = () => {
      const now = Date.now();
      let fired = false;
      for (const it of items) {
        if (alerted.current.has(it.id)) continue;
        if (new Date(it.dueAt).getTime() <= now) {
          alerted.current.add(it.id);
          fired = true;
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Follow-up due", { body: `${it.name} — time to call back`, tag: it.id });
          }
        }
      }
      if (fired) {
        beep();
        persist();
      }
    };

    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [items]);

  return null;
}
