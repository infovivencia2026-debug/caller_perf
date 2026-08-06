"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { clearCallTiming, draftFromForm, readCallTiming, writeCallTiming } from "@/lib/call-timer";
import { markPresent } from "@/lib/attendance";
import { endOfDay } from "@/lib/metrics";
import { CALL_STATUSES, CALL_TO_CUSTOMER_STATUS } from "@/lib/labels";

/**
 * Outcomes that mean "try again" — if the caller doesn't pick a follow-up date, the
 * lead is automatically scheduled for tomorrow so it comes back into the queue then.
 */
const RETRY_STATUSES = new Set(["NO_ANSWER", "BUSY", "SWITCHED_OFF", "DISCONNECTED", "CALLBACK_REQUESTED"]);

/**
 * Outcomes that mean the number is not a prospect at all. These leads are deleted from
 * the database rather than parked with a status: nothing should ever surface them
 * again — not the queue, not auto-assign, not a search. Every other outcome, including
 * "Not interested", leaves the lead in place to be called another day.
 */
const DELETE_STATUSES = new Set(["WRONG_NUMBER", "INVALID_NUMBER"]);

const saveSchema = z.object({
  customerId: z.string().min(1),
  status: z.enum(CALL_STATUSES as [string, ...string[]]),
  response: z.string().optional(),
  comments: z.string().optional(),
  // Only meaningful for "Interested"; stored on the call for reporting/export.
  course: z.string().optional(),
  followUpDate: z.string().optional(),
  // Blank means "the caller left the default alone": use MEDIUM for the follow-up but
  // do not rewrite the customer's own priority, which the queue orders by.
  priority: z.enum(["LOW", "MEDIUM", "HIGH", ""]),
  // Escape hatch for a call made without pressing Call first — see below.
  manualMinutes: z.string().optional(),
  // Editable customer details — saved together with the call so edits made on the
  // call are never lost.
  name: z.string().optional(),
  company: z.string().optional(),
  city: z.string().optional(),
  email: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  notes: z.string().optional(),
});

/**
 * Rebuilds the calling-screen URL, preserving the skip list and (when set) the focused
 * customer, and surfacing a message. `focus` pins a specific customer — it must survive
 * Start/End/Reset so a follow-up call doesn't jump back to the queue mid-timing.
 */
function queueHref(
  skipped: string,
  opts: { error?: string; saved?: boolean; focus?: string; savedCallId?: string } = {},
) {
  const params = new URLSearchParams();
  if (skipped) params.set("skip", skipped);
  if (opts.error) params.set("error", opts.error);
  if (opts.saved) params.set("saved", "1");
  // Lets the next screen offer "just saved — fix it", instead of the counsellor
  // having to hunt the call down in My calls.
  if (opts.savedCallId) params.set("last", opts.savedCallId);
  if (opts.focus) params.set("focus", opts.focus);
  const query = params.toString();
  return query ? `/caller/call?${query}` : "/caller/call";
}

/** Session cookie mirroring the skip list, so it survives navigating away and back. */
const SKIP_COOKIE = "cp_skip";

async function persistSkips(skipped: string) {
  const store = await cookies();
  if (skipped) store.set(SKIP_COOKIE, skipped, { path: "/", sameSite: "lax", httpOnly: true });
  else store.delete(SKIP_COOKIE);
}

/** "Start over" / "Bring them all back" — empty the skip list and return to the queue. */
export async function clearSkips() {
  await requireCaller();
  const store = await cookies();
  store.delete(SKIP_COOKIE);
  redirect("/caller/call");
}

function skippedFrom(formData: FormData) {
  return String(formData.get("skipped") ?? "")
    .split(",")
    .filter(Boolean)
    .join(",");
}

function focusFrom(formData: FormData) {
  return String(formData.get("focus") ?? "") || undefined;
}

/** Stamps the start of the call server-side; the page re-renders showing the clock. */
export async function startCall(formData: FormData) {
  await requireCaller();
  const customerId = String(formData.get("customerId") ?? "");
  const skipped = skippedFrom(formData);
  const focus = focusFrom(formData);
  if (!customerId) redirect(queueHref(skipped, { error: "Missing customer", focus }));

  await writeCallTiming({
    customerId,
    startedAt: new Date().toISOString(),
    draft: draftFromForm(formData),
  });
  redirect(queueHref(skipped, { focus }));
}

/** Stamps the end of the call. Start must have happened first. */
export async function endCall(formData: FormData) {
  await requireCaller();
  const customerId = String(formData.get("customerId") ?? "");
  const skipped = skippedFrom(formData);
  const focus = focusFrom(formData);

  const timing = await readCallTiming(customerId);
  if (!timing) redirect(queueHref(skipped, { error: "Start the call before ending it", focus }));
  if (timing.endedAt) return; // already ended; a double click is harmless

  await writeCallTiming({
    ...timing,
    endedAt: new Date().toISOString(),
    draft: draftFromForm(formData),
  });
  redirect(queueHref(skipped, { focus }));
}

/** Throws away a mis-stamped timing so the caller can start over. */
export async function resetCall(formData: FormData) {
  await requireCaller();
  await clearCallTiming();
  redirect(queueHref(skippedFrom(formData), { focus: focusFrom(formData) }));
}

export async function saveCall(formData: FormData) {
  const session = await requireCaller();
  const skipped = skippedFrom(formData);
  const focus = focusFrom(formData);

  // Keep the typed values alive across any redirect back to the form.
  const existing = await readCallTiming();
  if (existing) await writeCallTiming({ ...existing, draft: draftFromForm(formData) });

  const parsed = saveSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    status: String(formData.get("status") ?? ""),
    response: String(formData.get("response") ?? "").trim(),
    comments: String(formData.get("comments") ?? "").trim(),
    course: String(formData.get("course") ?? "").trim(),
    followUpDate: String(formData.get("followUpDate") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    manualMinutes: String(formData.get("manualMinutes") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (!parsed.success) {
    redirect(queueHref(skipped, { error: parsed.error.issues[0].message ?? "Please complete the call details", focus }));
  }

  const input = parsed.data;

  // Timings come from the cookie, never from the form, so they cannot be forged by
  // editing hidden inputs.
  const timing = existing?.customerId === input.customerId ? existing : null;

  // A counsellor who dialled without pressing Call used to be unable to log the
  // conversation at all — the save was refused and the call was simply lost. They can
  // now state the length instead. Only used when there is no stamped timing, so a
  // real timing can never be overridden by a typed number.
  const manualMinutes = input.manualMinutes ? Number(input.manualMinutes) : NaN;
  const manualEntry = !timing?.endedAt && Number.isFinite(manualMinutes) && manualMinutes >= 0;

  if (!timing?.endedAt && !manualEntry) {
    redirect(
      queueHref(skipped, {
        error: "Tap Call to start the timer, or use “Called without the timer?” to enter the length",
        focus,
      }),
    );
  }

  const now = new Date();
  const startedAt = manualEntry
    ? new Date(now.getTime() - Math.min(manualMinutes, 120) * 60 * 1000)
    : new Date(timing!.startedAt);
  const endedAt = manualEntry ? now : new Date(timing!.endedAt!);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    redirect(queueHref(skipped, { error: "Call timing was invalid — start the call again", focus }));
  }

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) redirect(queueHref(skipped, { error: "Customer not found", focus }));
  if (customer.assignedToId !== session.userId) {
    redirect(queueHref(skipped, { error: "This customer is not assigned to you", focus }));
  }

  const duration = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  // The timing cookie lives for four hours, so a forgotten End produces a "call" of
  // hours that quietly poisons talk time and averages. Anything past 45 minutes is
  // almost certainly that, so it is sent back rather than saved.
  if (duration > 45 * 60) {
    redirect(
      queueHref(skipped, {
        error: "That call is over 45 minutes — reset the timer and log it with the manual length",
        focus,
      }),
    );
  }

  const explicitDue = input.followUpDate ? new Date(input.followUpDate) : null;
  if (explicitDue && Number.isNaN(explicitDue.getTime())) {
    redirect(queueHref(skipped, { error: "Follow-up date is invalid", focus }));
  }
  // The caller's chosen date wins; otherwise a retry-type outcome schedules tomorrow.
  const followUpDue = explicitDue ?? (RETRY_STATUSES.has(input.status) ? endOfDay() : null);

  let savedCallId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const call = await tx.call.create({
      data: {
        customerId: customer.id,
        // Snapshot who was called. If this lead is deleted later (invalid number),
        // this is all that is left of them — see callLead.
        customerPhone: customer.phone,
        customerName: input.name?.trim() || customer.name || null,
        callerId: session.userId,
        status: input.status as never,
        response: input.response || null,
        comments: input.comments || null,
        // Course only applies to an interested lead.
        course: input.status === "INTERESTED" ? input.course || null : null,
        startedAt,
        endedAt,
        duration,
      },
    });

    await tx.customer.update({
      where: { id: customer.id },
      data: {
        status: CALL_TO_CUSTOMER_STATUS[input.status as keyof typeof CALL_TO_CUSTOMER_STATUS],
        // Only when the caller actively chose a priority — see saveSchema.
        ...(input.priority ? { priority: input.priority as never } : {}),
        // A scheduled callback stays with the counsellor who took the call, so it never
        // gets handed to someone else (auto-assign only touches unassigned leads anyway).
        assignedToId: session.userId,
        // Persist any edits the caller made to the lead's details on the call.
        name: input.name?.trim() ?? "",
        company: input.company?.trim() || null,
        city: input.city?.trim() || null,
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    // This call actions any outstanding follow-up, so close them before scheduling a new
    // one — otherwise an old future follow-up would keep the lead hidden.
    await tx.followUp.updateMany({
      where: { customerId: customer.id, status: "PENDING" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    savedCallId = call.id;

    if (followUpDue) {
      await tx.followUp.create({
        data: {
          customerId: customer.id,
          callerId: session.userId,
          callId: call.id,
          dueAt: followUpDue,
          priority: (input.priority || "MEDIUM") as never,
          notes: input.comments || null,
        },
      });
    }

    // A number that is not a real prospect is removed from the database entirely, so
    // nobody is ever handed it again. The call rows survive (customerId is SetNull and
    // the phone/name are snapshotted above), so the counsellor keeps credit for the
    // work and the day's numbers do not move. Follow-ups cascade away with the lead.
    if (DELETE_STATUSES.has(input.status)) {
      await tx.customer.delete({ where: { id: customer.id } });
    }
  });

  await logActivity({
    userId: session.userId,
    action: "CALL_LOGGED",
    entity: "Customer",
    entityId: customer.id,
    detail: `${customer.name} — ${input.status}`,
  });

  // Logging a call implies the caller was present today.
  await markPresent(session.userId);

  await clearCallTiming();
  revalidatePath("/caller");
  revalidatePath("/caller/call");
  revalidatePath("/caller/my-calls");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/calendar");
  redirect(queueHref(skipped, { savedCallId: savedCallId ?? undefined }));
}

/** Skipping records nothing; it just moves the caller past this customer for now. */
export async function skipCustomer(formData: FormData) {
  await requireCaller();
  const customerId = String(formData.get("customerId") ?? "");
  const skipped = String(formData.get("skipped") ?? "")
    .split(",")
    .filter(Boolean);
  const next = [...new Set([...skipped, customerId])].filter(Boolean);

  // Remember the skip list in a cookie so it survives navigating away and back.
  await persistSkips(next.join(","));
  // Drop any half-stamped timing so it cannot leak onto the next customer.
  await clearCallTiming();
  redirect(queueHref(next.join(",")));
}

const editSchema = z.object({
  callId: z.string().min(1),
  status: z.enum(CALL_STATUSES as [string, ...string[]]),
  response: z.string().optional(),
  comments: z.string().optional(),
  course: z.string().optional(),
});

/**
 * Lets a counsellor correct a call they logged themselves — the outcome picked in a
 * hurry, a typo in the response, a missing comment. Timings are not editable: they are
 * stamped by the Start/End buttons and are what the performance numbers are built on.
 */
export async function updateOwnCall(formData: FormData) {
  const session = await requireCaller();
  // Preserved so the caller lands back on the same date range they were looking at.
  const back = String(formData.get("back") ?? "/caller/my-calls");

  const parsed = editSchema.safeParse({
    callId: String(formData.get("callId") ?? ""),
    status: String(formData.get("status") ?? ""),
    response: String(formData.get("response") ?? "").trim(),
    comments: String(formData.get("comments") ?? "").trim(),
    course: String(formData.get("course") ?? "").trim(),
  });
  if (!parsed.success) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const input = parsed.data;

  const call = await prisma.call.findUnique({
    where: { id: input.callId },
    select: {
      id: true,
      callerId: true,
      customerId: true,
      startedAt: true,
      status: true,
      response: true,
      comments: true,
      course: true,
    },
  });
  if (!call || call.callerId !== session.userId) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent("That call is not yours to edit")}`);
  }

  const nextCourse = input.status === "INTERESTED" ? input.course || null : null;
  const changed =
    call.status !== input.status ||
    (call.response ?? null) !== (input.response || null) ||
    (call.comments ?? null) !== (input.comments || null) ||
    (call.course ?? null) !== nextCourse;

  // Nothing to record if the form came back unchanged — an empty audit row would just
  // be noise on the timeline.
  if (!changed) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}saved=1`);
  }

  // The customer's status mirrors their most recent call, so only re-derive it when
  // this is still the latest one — editing an old call must not rewind the lead. Skipped
  // entirely when the lead has been deleted (invalid number), hence the null check.
  const latest = call.customerId
    ? await prisma.call.findFirst({
        where: { customerId: call.customerId },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.call.update({
      where: { id: call.id },
      data: {
        status: input.status as never,
        response: input.response || null,
        comments: input.comments || null,
        course: nextCourse,
      },
    });

    // Keep what it said before. Editable history is only trustworthy if the original
    // survives the edit.
    await tx.callEdit.create({
      data: {
        callId: call.id,
        editorId: session.userId,
        fromStatus: call.status,
        toStatus: input.status as never,
        fromResponse: call.response,
        toResponse: input.response || null,
        fromComments: call.comments,
        toComments: input.comments || null,
        fromCourse: call.course,
        toCourse: nextCourse,
      },
    });

    if (call.customerId && latest?.id === call.id) {
      await tx.customer.update({
        where: { id: call.customerId },
        data: { status: CALL_TO_CUSTOMER_STATUS[input.status as keyof typeof CALL_TO_CUSTOMER_STATUS] },
      });
    }
  });

  await logActivity({
    userId: session.userId,
    action: "CALL_UPDATED",
    entity: "Call",
    entityId: call.id,
    detail: `Outcome ${call.status} → ${input.status}`,
  });

  revalidatePath("/caller/my-calls");
  revalidatePath("/caller");
  revalidatePath("/admin/calls");
  redirect(`${back}${back.includes("?") ? "&" : "?"}saved=1`);
}

const detailsSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().optional(),
  company: z.string().optional(),
  city: z.string().optional(),
  email: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  notes: z.string().optional(),
});

/**
 * Lets the caller fill in or correct the customer's details during the call — the
 * fields left empty at import time, or anything that turns out wrong on the phone.
 * Scoped to the caller's own customers; phone and status are not editable here.
 */
export async function saveCustomerDetails(formData: FormData) {
  const session = await requireCaller();
  const skipped = skippedFrom(formData);
  const focus = focusFrom(formData);

  const parsed = detailsSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (!parsed.success) {
    redirect(queueHref(skipped, { error: parsed.error.issues[0].message ?? "Could not save the details", focus }));
  }

  const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
  if (!customer) redirect(queueHref(skipped, { error: "Customer not found", focus }));
  if (customer.assignedToId !== session.userId) {
    redirect(queueHref(skipped, { error: "This customer is not assigned to you", focus }));
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name: parsed.data.name?.trim() ?? "",
      company: parsed.data.company?.trim() || null,
      city: parsed.data.city?.trim() || null,
      email: parsed.data.email?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    },
  });

  await logActivity({
    userId: session.userId,
    action: "CUSTOMER_UPDATED",
    entity: "Customer",
    entityId: customer.id,
    detail: `${customer.name || customer.phone} — details updated by ${session.name}`,
  });

  revalidatePath("/caller/call");
  revalidatePath("/caller");
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customer.id}`);
  redirect(queueHref(skipped, { saved: true, focus }));
}
