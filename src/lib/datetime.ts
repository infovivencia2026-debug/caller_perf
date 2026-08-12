/**
 * Every timestamp in the app is displayed in India time, regardless of where the
 * server or the browser happens to be. Formatting server-side with a fixed zone
 * also keeps the markup identical on both sides, so nothing shifts on hydration.
 */
export const TIME_ZONE = "Asia/Kolkata";
const LOCALE = "en-IN";

// en-CA renders as YYYY-MM-DD, which is exactly the day key we want.
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The India-time calendar day of a moment, as "YYYY-MM-DD". */
export function istDayKey(date: Date) {
  return dayKeyFmt.format(date);
}

/** UTC-midnight Date for the India-time calendar day — used for the Postgres DATE column. */
export function istDayUTC(date = new Date()) {
  const [y, m, d] = istDayKey(date).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const timeOnly = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const shortTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** e.g. "30 Jul 2026, 1:01 pm" */
export function formatDateTime(value: Date) {
  return dateTime.format(value);
}

/** e.g. "1:01:45 pm" — used for the live call clock. */
export function formatClock(value: Date) {
  return timeOnly.format(value);
}

/** e.g. "1:01 pm" */
export function formatShortTime(value: Date) {
  return shortTime.format(value);
}

/**
 * Clock reads live here rather than inline in a component: reading the current time
 * during render is impure, and the lint rules reject it. These values are only the
 * first paint anyway — the ticker in the root layout takes over within a second.
 */
export function elapsedSecondsSince(start: Date) {
  return Math.max(0, Math.round((Date.now() - start.getTime()) / 1000));
}

/** Current India time, for the initial render of the live clock. */
export function currentClock() {
  return formatClock(new Date());
}

/** Whole minutes elapsed since a moment — for "12m ago" style live status. */
export function minutesSince(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

/** 6 PM (end of the working day) — the cut-off after which a callback lapses. */
const CALLBACK_CUTOFF_HOUR = 18;

/**
 * A callback is live only through its due day, until 6 PM. After 6 PM on the due day it
 * is "missed" and drops off the active list. If the customer asked to be called back at a
 * specific time later than 6 PM, that later time is honoured as the cut-off instead.
 * The server runs in IST, so these hours are India time.
 */
export function isCallbackMissed(dueAt: Date, now = new Date()) {
  const cutoff = new Date(dueAt);
  cutoff.setHours(CALLBACK_CUTOFF_HOUR, 0, 0, 0);
  if (dueAt.getTime() > cutoff.getTime()) cutoff.setTime(dueAt.getTime());
  return now.getTime() > cutoff.getTime();
}
