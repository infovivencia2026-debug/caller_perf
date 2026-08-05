"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCaller } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { normalizePhone } from "@/lib/labels";

const schema = z.object({
  name: z.string().optional(),
  // Phone is the natural key — everything else can be filled in later, on the call.
  phone: z.string().min(7, "A valid phone number is required"),
  company: z.string().optional(),
  email: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

/**
 * Lets a counsellor add a lead they sourced themselves — a walk-in, a referral, a
 * number off a poster. It lands assigned to them, so it enters their own queue and
 * nobody else's, and it starts as NEW like any imported lead.
 *
 * The one case needing care is a phone that already exists, since phone is unique.
 * Rather than fail, we hand the lead over if it is unassigned, and refuse only when
 * it genuinely belongs to someone else.
 */
export async function addMyCustomer(formData: FormData) {
  const session = await requireCaller();

  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    priority: String(formData.get("priority") ?? "MEDIUM"),
  });
  if (!parsed.success) {
    redirect(`/caller/customers/new?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) redirect(`/caller/customers/new?error=${encodeURIComponent("That phone number is not valid")}`);

  const existing = await prisma.customer.findUnique({
    where: { phone },
    select: { id: true, assignedToId: true, assignedTo: { select: { name: true } } },
  });

  if (existing) {
    if (existing.assignedToId && existing.assignedToId !== session.userId) {
      redirect(
        `/caller/customers/new?error=${encodeURIComponent(
          `${phone} is already assigned to ${existing.assignedTo?.name ?? "another counsellor"}`,
        )}`,
      );
    }
    // Unassigned, or already theirs: take it rather than reject the form.
    await prisma.customer.update({ where: { id: existing.id }, data: { assignedToId: session.userId } });
    await logActivity({
      userId: session.userId,
      action: "CUSTOMER_CLAIMED",
      entity: "Customer",
      entityId: existing.id,
      detail: `${phone} claimed by ${session.name}`,
    });
    revalidatePath("/caller/call");
    redirect(`/caller/customers/${existing.id}?claimed=1`);
  }

  const created = await prisma.customer.create({
    data: {
      name: input.name || "",
      phone,
      company: input.company || null,
      email: input.email || null,
      city: input.city || null,
      notes: input.notes || null,
      priority: input.priority as never,
      assignedToId: session.userId,
    },
  });

  await logActivity({
    userId: session.userId,
    action: "CUSTOMER_CREATED",
    entity: "Customer",
    entityId: created.id,
    detail: `${created.name || created.phone} added by ${session.name}`,
  });

  revalidatePath("/caller");
  revalidatePath("/caller/call");
  revalidatePath("/admin/customers");
  redirect(`/caller/customers/${created.id}?added=1`);
}
