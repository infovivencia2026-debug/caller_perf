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

/**
 * Whole days a due date is overdue, NOT counting Sundays (nobody works Sunday). 0 means
 * due today or in the future. The server runs in IST, so getDay() is the India weekday.
 * A callback due Saturday reads as 0 overdue on Saturday and 1 on Monday (Sunday skipped),
 * so it carries to Monday rather than lapsing over the weekend.
 */
export function workingDaysOverdue(dueAt: Date, now = new Date()) {
  const due = new Date(dueAt);
  due.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (today <= due) return 0;
  let count = 0;
  const cursor = new Date(due);
  while (cursor < today) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() !== 0) count += 1; // 0 = Sunday, doesn't count
  }
  return count;
}

/** A callback gets its due day plus one working day; after that it's "missed". */
export function isCallbackMissed(dueAt: Date, now = new Date()) {
  return workingDaysOverdue(dueAt, now) >= 2;
}
