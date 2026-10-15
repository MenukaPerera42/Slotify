import { randomBytes } from "node:crypto";
import { appendFileSync, chmodSync } from "node:fs";
import { hash, verify } from "argon2";
import { PrismaClient } from "@prisma/client";

const file = ".env.staging.local";
const directUrl = process.env.DIRECT_URL;
if (!directUrl) throw new Error("DIRECT_URL is required for the guarded staging seed");
const target = new URL(directUrl);
if (target.hostname.includes("-pooler") || !target.hostname.endsWith(".neon.tech")
  || decodeURIComponent(target.pathname) !== "/slotify_staging") {
  throw new Error("Staging seed requires the direct Neon slotify_staging database");
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function main() {
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`
    SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "slotify_staging" || identity[0]?.role !== "slotify_staging_owner") {
    throw new Error("Staging database identity mismatch");
  }
  const existingUsers = await prisma.user.findMany();
  if (existingUsers.length && (existingUsers.length !== 2
    || !process.env.STAGING_ADMIN_EMAIL || !process.env.STAGING_ADMIN_PASSWORD
    || !process.env.STAGING_MEMBER_EMAIL || !process.env.STAGING_MEMBER_PASSWORD
    || !existingUsers.some((user) => user.email === process.env.STAGING_ADMIN_EMAIL && user.role === "ADMIN")
    || !existingUsers.some((user) => user.email === process.env.STAGING_MEMBER_EMAIL && user.role === "MEMBER"))) {
    throw new Error("Staging accounts differ from the private fixture record; review manually");
  }
  const department = await prisma.department.upsert({
    where: { code: "STAGE" }, update: {},
    create: { code: "STAGE", name: "Staging QA" },
  });
  const category = await prisma.resourceCategory.upsert({
    where: { name: "Staging Rooms" }, update: {},
    create: { name: "Staging Rooms", description: "Preview verification resources" },
  });
  const room = await prisma.resource.findFirst({ where: { name: "Staging Meeting Room", categoryId: category.id } });
  if (!room) await prisma.resource.create({ data: {
    name: "Staging Meeting Room", location: "Preview QA", categoryId: category.id, capacity: 4,
  } });
  const existingShift = await prisma.officeShift.findUnique({ where: { name: "Staging Morning Shift" } });
  if (!existingShift) await prisma.officeShift.create({ data: {
    name: "Staging Morning Shift", mode: "MORNING", startMinute: 480,
    durationMinutes: 570, isActive: true, description: "8:00 AM to 5:30 PM, staging only",
  } });

  if (existingUsers.length) {
    const admin = existingUsers.find((user) => user.email === process.env.STAGING_ADMIN_EMAIL)!;
    const member = existingUsers.find((user) => user.email === process.env.STAGING_MEMBER_EMAIL)!;
    if (!admin.passwordHash || !member.passwordHash
      || !(await verify(admin.passwordHash, process.env.STAGING_ADMIN_PASSWORD!))
      || !(await verify(member.passwordHash, process.env.STAGING_MEMBER_PASSWORD!))) {
      throw new Error("Staging credential record does not match the database");
    }
    console.log("Staging fixture already present; no account or credential changed.");
  } else {
    const suffix = randomBytes(6).toString("hex");
    const adminEmail = `slotify-staging-admin-${suffix}@example.test`;
    const memberEmail = `slotify-staging-member-${suffix}@example.test`;
    const adminPassword = randomBytes(24).toString("base64url");
    const memberPassword = randomBytes(24).toString("base64url");
    await prisma.user.create({ data: { name: "Staging Admin", email: adminEmail,
      role: "ADMIN", departmentId: department.id, passwordHash: await hash(adminPassword) } });
    await prisma.user.create({ data: { name: "Staging Member", email: memberEmail,
      role: "MEMBER", departmentId: department.id, passwordHash: await hash(memberPassword) } });
    appendFileSync(file, `STAGING_ADMIN_EMAIL=${JSON.stringify(adminEmail)}\nSTAGING_ADMIN_PASSWORD=${JSON.stringify(adminPassword)}\nSTAGING_MEMBER_EMAIL=${JSON.stringify(memberEmail)}\nSTAGING_MEMBER_PASSWORD=${JSON.stringify(memberPassword)}\n`, { mode: 0o600 });
    chmodSync(file, 0o600);
    console.log("Staging fixtures created; credentials stored only in ignored mode-0600 file.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Staging seed failed");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
