/**
 * Seed script: creates test admin + test student accounts.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Accounts created:
 *   admin@artweb.ru  / Admin123!   (ADMIN, email verified)
 *   student@artweb.ru / Student123! (STUDENT, email verified)
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth-password";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const accounts = [
    {
      email: "admin@artweb.ru",
      password: "Admin123!",
      firstName: "Admin",
      lastName: "ARTWEB",
      role: "ADMIN" as const,
    },
    {
      email: "student@artweb.ru",
      password: "Student123!",
      firstName: "Студент",
      lastName: "Тестовый",
      role: "STUDENT" as const,
    },
  ];

  for (const acc of accounts) {
    const existing = await prisma.user.findUnique({
      where: { email: acc.email },
    });

    if (existing) {
      console.log(`[SKIP] ${acc.email} already exists (id: ${existing.id})`);
      continue;
    }

    const passwordHash = await hashPassword(acc.password);

    const user = await prisma.user.create({
      data: {
        email: acc.email,
        passwordHash,
        firstName: acc.firstName,
        lastName: acc.lastName,
        role: acc.role,
        emailVerified: true,
        isActive: true,
      },
    });

    console.log(`[OK] ${acc.email} created (id: ${user.id}, role: ${acc.role})`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
