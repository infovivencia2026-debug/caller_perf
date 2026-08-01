"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { clearCallTiming, draftFromForm, readCallTiming, writeCallTiming } from "@/lib/call-timer";
import { CALL_STATUSES, CALL_TO_CUSTOMER_STATUS } from "@/lib/labels";

const saveSchema = z.object({
  customerId: z.string().min(1),
  status: z.enum(CALL_STATUSES as [string, ...string[]]),
  response: z.string().optional(),
  comments: z.string().optional(),
  followUpDate: z.string().optional(),
  // Blank means "the caller left the default alone": use MEDIUM for the follow-up but
  // do not rewrite the customer's own priority, which the queue orders by.
  priority: z.enum(["LOW", "MEDIUM", "HIGH", ""]),
});

/** Rebuilds the calling-screen URL, preserving the skip list and surfacing an error. */
function queueHref(skipped: string, error?: string) {
  const params = new URLSearchParams();
  if (skipped) params.set("skip", skipped);
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/caller/call?${query}` : "/caller/call";
}

function skippedFrom(formData: FormData) {
  return String(formData.get("skipped") ?? "")
    .split(",")
    .filter(Boolean)
    .join(",");
}

/** Stamps the start of the call server-side; the page re-renders showing the clock. */
export async function startCall(formData: FormData) {
  await requireCaller();
  const customerId = String(formData.get("customerId") ?? "");
  const skipped = skippedFrom(formData);
  if (!customerId) redirect(queueHref(skipped, "Missing customer"));

  await writeCallTiming({
    customerId,
    startedAt: new Date().toISOString(),
    draft: draftFromForm(formData),
  });
  redirect(queueHref(skipped));
}

/** Stamps the end of the call. Start must have happened first. */
export async function endCall(formData: FormData) {
  await requireCaller();
  const customerId = String(formData.get("customerId") ?? "");
  const skipped = skippedFrom(formData);

  const timing = await readCallTiming(customerId);
  if (!timing) redirect(queueHref(skipped, "Start the call before ending it"));
  if (timing.endedAt) return; // already ended; a double click is harmless

  await writeCallTiming({
    ...timing,
    endedAt: new Date().toISOString(),
    draft: draftFromForm(formData),
  });
  redirect(queueHref(skipped));
}

/** Throws away a mis-stamped timing so the caller can start over. */
export async function resetCall(formData: FormData) {
  await requireCaller();
  await clearCallTiming();
  redirect(queueHref(skippedFrom(formData)));
}

export async function saveCall(formData: FormData) {
  const session = await requireCaller();
  const skipped = skippedFrom(formData);

  // Keep the typed values alive across any redirect back to the form.
  const existing = await readCallTiming();
  if (existing) await writeCallTiming({ ...existing, draft: draftFromForm(formData) });

  const parsed = saveSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    status: String(formData.get("status") ?? ""),
    response: String(formData.get("response") ?? "").trim(),
    comments: String(formData.get("comments") ?? "").trim(),
    followUpDate: String(formData.get("followUpDate") ?? ""),
    priority: String(formData.get("priority") ?? ""),
  });
  if (!parsed.success) {
    redirect(queueHref(skipped, parsed.error.issues[0].message ?? "Please complete the call details"));
  }

  const input = parsed.data;

  // Timings come from the cookie, never from the form, so they cannot be forged
  // by editing hidden inputs.
  const timing = existing?.customerId === input.customerId ? existing : null;
  if (!timing?.endedAt) {
    redirect(queueHref(skipped, "Start and end the call before saving"));
  }
  const startedAt = new Date(timing.startedAt);
  const endedAt = new Date(timing.endedAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    redirect(queueHref(skipped, "Call timing was invalid — start the call again"));
  }

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) redirect(queueHref(skipped, "Customer not found"));
  if (customer.assignedToId !== session.userId) {
    redirect(queueHref(skipped, "This customer is not assigned to you"));
  }

  const duration = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

  const followUpDue = input.followUpDate ? new Date(input.followUpDate) : null;
  if (followUpDue && Number.isNaN(followUpDue.getTime())) {
    redirect(queueHref(skipped, "Follow-up date is invalid"));
  }

  await prisma.$transaction(async (tx) => {
    const call = await tx.call.create({
      data: {
        customerId: customer.id,
        callerId: session.userId,
        status: input.status as never,
        response: input.response || null,
        comments: input.comments || null,
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
      },
    });

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
  });

  await logActivity({
    userId: session.userId,
    action: "CALL_LOGGED",
    entity: "Customer",
    entityId: customer.id,
    detail: `${customer.name} — ${input.status}`,
  });

  await clearCallTiming();
  revalidatePath("/caller");
  revalidatePath("/caller/call");
  redirect(queueHref(skipped));
}

/** Skipping records nothing; it just moves the caller past this customer for now. */
export async function skipCustomer(formData: FormData) {
  await requireCaller();
  const customerId = String(formData.get("customerId") ?? "");
  const skipped = String(formData.get("skipped") ?? "")
    .split(",")
    .filter(Boolean);
  const next = [...new Set([...skipped, customerId])].filter(Boolean);

  // Drop any half-stamped timing so it cannot leak onto the next customer.
  await clearCallTiming();
  redirect(queueHref(next.join(",")));
}
