import type { PrismaClient } from "@prisma/client";

export const STANDARD_DEPARTMENTS = [
  { code: "HR", name: "Human Resources" },
  { code: "ENG", name: "Engineering" },
  { code: "FE", name: "Frontend Development" },
  { code: "BE", name: "Backend Development" },
  { code: "MOBILE", name: "Mobile Development" },
  { code: "IT", name: "IT Support" },
] as const;

export async function seedDepartments(prisma: PrismaClient) {
  for (const department of STANDARD_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: department.code }, update: {},
      create: department,
    });
  }
}
