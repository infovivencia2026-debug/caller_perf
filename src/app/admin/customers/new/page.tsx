import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import CustomerForm from "../customer-form";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const callers = await prisma.user.findMany({
    where: { role: "TELECALLER" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Add customer</h1>
      <Card>
        <CustomerForm callers={callers} />
      </Card>
    </div>
  );
}
