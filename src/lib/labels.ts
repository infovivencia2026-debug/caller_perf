import type { CallStatus, CustomerStatus, Priority } from "@/generated/prisma/enums";

export const CALL_STATUSES: CallStatus[] = [
  "INTERESTED",
  "NOT_INTERESTED",
  "NO_ANSWER",
  "BUSY",
  "SWITCHED_OFF",
  "OUT_OF_SERVICE",
  "DISCONNECTED",
  "WRONG_NUMBER",
  "CALLBACK_REQUESTED",
  "EXISTING_CUSTOMER",
  "SALE_CLOSED",
  "INVALID_NUMBER",
];

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "NO_ANSWER",
  "BUSY",
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK",
  "MEETING_SCHEDULED",
  "CLOSED",
  "INVALID",
];

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

/** The courses a caller can tag an interested lead with. */
export const COURSES = [
  "AI Career Accelerator",
  "AI Generalist",
  "AI Architect",
  "Cyber Security",
  "SOC Analyst",
] as const;

/** Call outcomes that count as a successful contact for conversion metrics. */
export const SUCCESS_STATUSES: CallStatus[] = [
  "INTERESTED",
  "MEETING_SCHEDULED",
  "SALE_CLOSED",
  "EXISTING_CUSTOMER",
];

/** Call outcomes that convert a lead. */
export const CONVERTED_STATUSES: CallStatus[] = ["SALE_CLOSED"];

/** How a call outcome moves the customer's own status. */
export const CALL_TO_CUSTOMER_STATUS: Record<CallStatus, CustomerStatus> = {
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  NO_ANSWER: "NO_ANSWER",
  BUSY: "BUSY",
  SWITCHED_OFF: "IN_PROGRESS",
  OUT_OF_SERVICE: "INVALID",
  DISCONNECTED: "IN_PROGRESS",
  WRONG_NUMBER: "INVALID",
  CALLBACK_REQUESTED: "CALLBACK",
  MEETING_SCHEDULED: "MEETING_SCHEDULED",
  EXISTING_CUSTOMER: "CLOSED",
  SALE_CLOSED: "CLOSED",
  INVALID_NUMBER: "INVALID",
};

/**
 * The lead a call was made to. Reads the live customer when they still exist, and
 * falls back to the snapshot stored on the call itself when the lead has been deleted
 * (an invalid number). Every call display goes through this, so history never shows a
 * blank where a deleted lead used to be.
 */
export function callLead(call: {
  customer?: { name?: string | null; phone: string; company?: string | null; city?: string | null } | null;
  customerPhone: string;
  customerName: string | null;
}) {
  if (call.customer) return { ...call.customer, deleted: false };
  return {
    name: call.customerName ?? "",
    phone: call.customerPhone,
    company: null as string | null,
    city: null as string | null,
    deleted: true,
  };
}

/** What a counsellor is called throughout the UI. */
export const COUNSELLOR = "Counsellor";
export const COUNSELLORS = "Counsellors";

/** A customer's display label — their name, or their phone number when unnamed. */
export function customerLabel(customer: { name?: string | null; phone: string }) {
  const name = customer.name?.trim();
  return name && name.length > 0 ? name : customer.phone;
}

/**
 * Compact outcome labels for tight spots — the outcome chips on the calling panel,
 * where two columns on a narrow phone leave no room for "Callback Requested".
 */
const SHORT_STATUS: Record<string, string> = {
  NO_ANSWER: "Not answered",
  BUSY: "Busy",
  SWITCHED_OFF: "Switched off",
  OUT_OF_SERVICE: "Out of service",
  DISCONNECTED: "Disconnected",
  NOT_INTERESTED: "Not interested",
  INTERESTED: "Interested",
  WRONG_NUMBER: "Wrong number",
  CALLBACK_REQUESTED: "Callback",
  MEETING_SCHEDULED: "Meeting",
  EXISTING_CUSTOMER: "Existing",
  SALE_CLOSED: "Closed sale",
  INVALID_NUMBER: "Invalid",
};

export function shortStatus(value: string) {
  return SHORT_STATUS[value] ?? humanize(value);
}

/** Display overrides where the auto-generated words aren't quite right. */
const HUMANIZE_OVERRIDES: Record<string, string> = { NO_ANSWER: "Not answered" };

export function humanize(value: string) {
  if (HUMANIZE_OVERRIDES[value]) return HUMANIZE_OVERRIDES[value];
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

/** Normalizes a phone number to digits for duplicate detection. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
