import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CUSTOMERS = [
  { name: "Ravi Kumar", phone: "9876543210", company: "Sri Traders", city: "Hyderabad" },
  { name: "Anita Sharma", phone: "9876501234", company: "Sharma Textiles", city: "Pune" },
  { name: "Mohammed Iqbal", phone: "9812345678", company: "Iqbal Motors", city: "Chennai" },
  { name: "Deepa Nair", phone: "9900112233", company: "Nair Exports", city: "Kochi" },
  { name: "Suresh Reddy", phone: "9701234567", company: "Reddy Agro", city: "Warangal" },
  { name: "Priya Menon", phone: "9611122233", company: "Menon Interiors", city: "Bengaluru" },
];

async function main() {
  // Never bootstrap a real deployment with the demo password. Set SEED_PASSWORD when
  // seeding anything that is not a throwaway local database.
  const password = process.env.SEED_PASSWORD || "password123";
  if (password === "password123") {
    console.warn("! Seeding with the default demo password. Set SEED_PASSWORD for a real deployment.");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { name: "Admin", email: "admin@example.com", passwordHash, role: "ADMIN" },
  });

  const callers = await Promise.all(
    [
      { name: "Lakshmi Devi", email: "lakshmi@example.com", dailyTarget: 60 },
      { name: "Arjun Rao", email: "arjun@example.com", dailyTarget: 50 },
    ].map((caller) =>
      prisma.user.upsert({
        where: { email: caller.email },
        update: {},
        create: { ...caller, passwordHash, role: "TELECALLER" },
      }),
    ),
  );

  for (const [index, customer] of CUSTOMERS.entries()) {
    await prisma.customer.upsert({
      where: { phone: customer.phone },
      update: {},
      create: {
        ...customer,
        priority: index % 3 === 0 ? "HIGH" : "MEDIUM",
        assignedToId: callers[index % callers.length].id,
      },
    });
  }

  console.log(
    `Seeded: admin=${admin.email}, callers=${callers.map((c) => c.email).join(", ")}, ${CUSTOMERS.length} customers.` +
      (process.env.SEED_PASSWORD ? " Password: as set in SEED_PASSWORD." : " Password for all: password123"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
