import { endOfDay, startOfDay, startOfMonth, startOfWeek } from "@/lib/metrics";

/**
 * Dashboard filters live entirely in the URL, so a filtered view can be bookmarked,
 * shared or reloaded, and the page needs no client JavaScript to apply them.
 */
export const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export type ReportFilters = {
  range: RangeKey;
  from?: Date;
  to?: Date;
  /** Empty means every counsellor. */
  callerId: string;
  fromInput: string;
  toInput: string;
  label: string;
  isFiltered: boolean;
};

/** Parses a yyyy-mm-dd value from a date input; returns null for junk. */
function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function resolveFilters(params: {
  range?: string;
  from?: string;
  to?: string;
  caller?: string;
}): ReportFilters {
  const range = (RANGES.find((r) => r.key === params.range)?.key ?? "month") as RangeKey;
  const callerId = params.caller ?? "";

  const customFrom = parseDate(params.from);
  const customTo = parseDate(params.to);

  let from: Date | undefined;
  let to: Date | undefined;
  let label: string;

  switch (range) {
    case "today":
      from = startOfDay();
      to = endOfDay();
      label = "Today";
      break;
    case "yesterday": {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      from = startOfDay(yesterday);
      to = endOfDay(yesterday);
      label = "Yesterday";
      break;
    }
    case "last7":
    case "last30": {
      // Rolling windows include today, so "last 7 days" is today plus the six before
      // it — what people mean when they say it.
      const days = range === "last7" ? 7 : 30;
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      from = startOfDay(start);
      to = endOfDay();
      label = `Last ${days} days`;
      break;
    }
    case "lastmonth": {
      const firstOfThis = startOfMonth();
      const firstOfLast = new Date(firstOfThis);
      firstOfLast.setMonth(firstOfLast.getMonth() - 1);
      from = firstOfLast;
      to = firstOfThis;
      label = "Last month";
      break;
    }
    case "week":
      from = startOfWeek();
      label = "This week";
      break;
    case "all":
      label = "All time";
      break;
    case "custom":
      from = customFrom ?? undefined;
      // A date input names a day; the range must cover all of it.
      to = customTo ? endOfDay(customTo) : undefined;
      label =
        from && to
          ? `${toInputValue(from)} to ${toInputValue(customTo!)}`
          : from
            ? `From ${toInputValue(from)}`
            : to
              ? `Up to ${toInputValue(customTo!)}`
              : "All time";
      break;
    default:
      from = startOfMonth();
      label = "This month";
  }

  return {
    range,
    from,
    to,
    callerId,
    fromInput: customFrom ? toInputValue(customFrom) : "",
    toInput: customTo ? toInputValue(customTo) : "",
    label,
    isFiltered: range !== "month" || Boolean(callerId),
  };
}
