import { cookies } from "next/headers";

/**
 * Call timing lives in a short-lived cookie rather than in React state, so the
 * calling screen works as plain HTML: "Start call" and "End call" are ordinary
 * form posts and the server stamps the clock. Nothing here needs JavaScript.
 *
 * It is deliberately not a database row — an abandoned call should expire on its
 * own rather than leave a half-written Call to clean up.
 */
const COOKIE = "cp_call";
const MAX_AGE_SECONDS = 60 * 60 * 4;

/**
 * The in-progress form values ride along with the timing so that pressing
 * Start/End — which is a full page post — does not wipe what the caller typed.
 */
export type CallDraft = {
  status?: string;
  response?: string;
  comments?: string;
  course?: string;
  followUpDate?: string;
  priority?: string;
  // Editable customer details, so edits made during the call survive Start/End posts.
  name?: string;
  company?: string;
  city?: string;
  email?: string;
  notes?: string;
};

export type CallTiming = {
  customerId: string;
  startedAt: string;
  endedAt?: string;
  draft?: CallDraft;
};

/** Cookies are capped at ~4KB, so free-text fields are trimmed before storing. */
export function draftFromForm(formData: FormData): CallDraft {
  const field = (name: string, max: number) =>
    String(formData.get(name) ?? "").trim().slice(0, max) || undefined;

  return {
    status: field("status", 40),
    response: field("response", 200),
    comments: field("comments", 1000),
    course: field("course", 80),
    followUpDate: field("followUpDate", 40),
    priority: field("priority", 10),
    name: field("name", 120),
    company: field("company", 120),
    city: field("city", 80),
    email: field("email", 160),
    notes: field("notes", 1000),
  };
}

export async function readCallTiming(customerId?: string): Promise<CallTiming | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  let parsed: CallTiming;
  try {
    parsed = JSON.parse(raw) as CallTiming;
  } catch {
    return null;
  }
  if (!parsed?.customerId || !parsed.startedAt) return null;
  // A timing left over from a customer we have since moved past is not ours.
  if (customerId && parsed.customerId !== customerId) return null;
  return parsed;
}

export async function writeCallTiming(timing: CallTiming) {
  (await cookies()).set(COOKIE, JSON.stringify(timing), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearCallTiming() {
  (await cookies()).delete(COOKIE);
}
