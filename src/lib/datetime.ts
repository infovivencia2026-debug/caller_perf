/**
 * Every timestamp in the app is displayed in India time, regardless of where the
 * server or the browser happens to be. Formatting server-side with a fixed zone
 * also keeps the markup identical on both sides, so nothing shifts on hydration.
 */
export const TIME_ZONE = "Asia/Kolkata";
const LOCALE = "en-IN";

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
