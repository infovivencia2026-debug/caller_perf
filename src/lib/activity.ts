import { prisma } from "@/lib/prisma";

export async function logActivity(input: {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: string;
}) {
  await prisma.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      detail: input.detail,
    },
  });
}
