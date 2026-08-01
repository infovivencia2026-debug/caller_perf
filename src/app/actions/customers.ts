"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { normalizePhone } from "@/lib/labels";
import { parseTags, serializeTags } from "@/lib/tags";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(7, "A valid phone number is required"),
  company: z.string().optional(),
  email: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum([
    "NEW",
    "IN_PROGRESS",
    "INTERESTED",
    "NOT_INTERESTED",
    "CALLBACK",
    "MEETING_SCHEDULED",
    "CLOSED",
    "INVALID",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  tags: z.string().optional(),
  assignedToId: z.string().optional(),
});

export type CustomerFormState = { error?: string; success?: string };

function parseForm(formData: FormData) {
  return customerSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    status: String(formData.get("status") ?? "NEW"),
    priority: String(formData.get("priority") ?? "MEDIUM"),
    tags: String(formData.get("tags") ?? "").trim(),
    assignedToId: String(formData.get("assignedToId") ?? ""),
  });
}

function toData(input: z.infer<typeof customerSchema>) {
  return {
    name: input.name,
    phone: normalizePhone(input.phone),
    company: input.company || null,
    email: input.email || null,
    city: input.city || null,
    notes: input.notes || null,
    status: input.status,
    priority: input.priority,
    tags: serializeTags(parseTags(input.tags)),
    assignedToId: input.assignedToId || null,
  };
}

export async function createCustomer(
  _state: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = toData(parsed.data);
  const existing = await prisma.customer.findUnique({ where: { phone: data.phone } });
  if (existing) return { error: `A customer with phone ${data.phone} already exists` };

  const created = await prisma.customer.create({ data });
  await logActivity({
    userId: session.userId,
    action: "CUSTOMER_CREATED",
    entity: "Customer",
    entityId: created.id,
    detail: created.name,
  });
  revalidatePath("/admin/customers");
  return { success: `Added ${created.name}` };
}

export async function updateCustomer(
  _state: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing customer id" };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = toData(parsed.data);
  const clash = await prisma.customer.findFirst({ where: { phone: data.phone, id: { not: id } } });
  if (clash) return { error: `Phone ${data.phone} belongs to another customer` };

  const before = await prisma.customer.findUnique({ where: { id } });
  const updated = await prisma.customer.update({ where: { id }, data });
  await logActivity({
    userId: session.userId,
    action: "CUSTOMER_UPDATED",
    entity: "Customer",
    entityId: id,
    detail:
      before && before.assignedToId !== updated.assignedToId
        ? `${updated.name} — assignment changed`
        : updated.name,
  });
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  return { success: "Saved" };
}

export async function bulkAssign(formData: FormData) {
  const session = await requireAdmin();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const assignedToId = String(formData.get("assignedToId") ?? "") || null;
  if (ids.length === 0) return;

  await prisma.customer.updateMany({ where: { id: { in: ids } }, data: { assignedToId } });
  await logActivity({
    userId: session.userId,
    action: "ASSIGNMENT_CHANGED",
    entity: "Customer",
    detail: `${ids.length} customer(s) ${assignedToId ? `assigned to ${assignedToId}` : "unassigned"}`,
  });
  revalidatePath("/admin/customers");
}
