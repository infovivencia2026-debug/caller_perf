"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { CALL_STATUSES, CALL_TO_CUSTOMER_STATUS } from "@/lib/labels";

const saveSchema = z.object({
  customerId: z.string().min(1),
  status: z.enum(CALL_STATUSES as [string, ...string[]]),
  response: z.string().optional(),
  comments: z.string().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  followUpDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export type SaveCallState = { error?: string };

export async function saveCall(_state: SaveCallState, formData: FormData): Promise<SaveCallState> {
  const session = await requireCaller();

  const parsed = saveSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    status: String(formData.get("status") ?? ""),
    response: String(formData.get("response") ?? "").trim(),
    comments: String(formData.get("comments") ?? "").trim(),
    startedAt: String(formData.get("startedAt") ?? ""),
    endedAt: String(formData.get("endedAt") ?? ""),
    followUpDate: String(formData.get("followUpDate") ?? ""),
    priority: String(formData.get("priority") ?? "MEDIUM"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message ?? "Please complete the call details" };
  }

  const input = parsed.data;
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) return { error: "Customer not found" };
  if (customer.assignedToId !== session.userId) {
    return { error: "This customer is not assigned to you" };
  }

  const duration = Math.max(0, Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 1000));

  const followUpDue = input.followUpDate ? new Date(input.followUpDate) : null;
  if (followUpDue && Number.isNaN(followUpDue.getTime())) {
    return { error: "Follow-up date is invalid" };
  }

  await prisma.$transaction(async (tx) => {
    const call = await tx.call.create({
      data: {
        customerId: customer.id,
        callerId: session.userId,
        status: input.status as never,
        response: input.response || null,
        comments: input.comments || null,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        duration,
      },
    });

    await tx.customer.update({
      where: { id: customer.id },
      data: {
        status: CALL_TO_CUSTOMER_STATUS[input.status as keyof typeof CALL_TO_CUSTOMER_STATUS],
        priority: input.priority as never,
      },
    });

    if (followUpDue) {
      await tx.followUp.create({
        data: {
          customerId: customer.id,
          callerId: session.userId,
          callId: call.id,
          dueAt: followUpDue,
          priority: input.priority as never,
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

  revalidatePath("/caller");
  revalidatePath("/caller/call");
  redirect("/caller/call");
}

/** Skipping records nothing; it just moves the caller past this customer for now. */
export async function skipCustomer(formData: FormData) {
  await requireCaller();
  const customerId = String(formData.get("customerId") ?? "");
  const skipped = String(formData.get("skipped") ?? "")
    .split(",")
    .filter(Boolean);
  const next = [...new Set([...skipped, customerId])].filter(Boolean);
  redirect(`/caller/call?skip=${next.join(",")}`);
}
