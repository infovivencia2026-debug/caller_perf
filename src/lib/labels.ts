import type { CallStatus, CustomerStatus, Priority } from "@/generated/prisma/enums";

export const CALL_STATUSES: CallStatus[] = [
  "INTERESTED",
  "NOT_INTERESTED",
  "NO_ANSWER",
  "BUSY",
  "SWITCHED_OFF",
  "WRONG_NUMBER",
  "CALLBACK_REQUESTED",
  "MEETING_SCHEDULED",
  "EXISTING_CUSTOMER",
  "SALE_CLOSED",
  "INVALID_NUMBER",
];

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  "NEW",
  "IN_PROGRESS",
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
  NO_ANSWER: "IN_PROGRESS",
  BUSY: "IN_PROGRESS",
  SWITCHED_OFF: "IN_PROGRESS",
  WRONG_NUMBER: "INVALID",
  CALLBACK_REQUESTED: "CALLBACK",
  MEETING_SCHEDULED: "MEETING_SCHEDULED",
  EXISTING_CUSTOMER: "CLOSED",
  SALE_CLOSED: "CLOSED",
  INVALID_NUMBER: "INVALID",
};

/** A customer's display label — their name, or their phone number when unnamed. */
export function customerLabel(customer: { name?: string | null; phone: string }) {
  const name = customer.name?.trim();
  return name && name.length > 0 ? name : customer.phone;
}

export function humanize(value: string) {
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
