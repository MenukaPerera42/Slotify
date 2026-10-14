import "server-only";
import { hash } from "argon2";
import { Prisma } from "@prisma/client";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { AdminUserError } from "../types";
import type { CreateMemberInput, ListUsersInput, UpdateUserProfileInput } from "../schemas/admin-user-schema";
import { displayName } from "../utils/display-name";
import { createChallenge, ensureEmailAvailable } from "@/features/email-verification/service";

const userSelect = {
  id: true, firstName: true, lastName: true, name: true, email: true, role: true,
  isActive: true, departmentId: true, createdAt: true, updatedAt: true,
  department: { select: { id: true, name: true, code: true, isActive: true } },
} satisfies Prisma.UserSelect;

async function admin() {
  const actor = await currentUser();
  if (!actor) throw new AdminUserError("UNAUTHENTICATED", "Sign in with an active account to continue.");
  if (actor.role !== "ADMIN") throw new AdminUserError("FORBIDDEN", "Administrator access is required.");
  return actor;
}

function withDisplayName<T extends { firstName: string | null; lastName: string | null; name: string }>(user: T) {
  return { ...user, displayName: displayName(user) };
}

export async function listUsers(input: ListUsersInput) {
  await admin();
  const where: Prisma.UserWhereInput = {
    ...(input.role ? { role: input.role } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.search ? { OR: [
      { name: { contains: input.search, mode: "insensitive" } },
      { firstName: { contains: input.search, mode: "insensitive" } },
      { lastName: { contains: input.search, mode: "insensitive" } },
      { email: { contains: input.search, mode: "insensitive" } },
    ] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: userSelect, orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.user.count({ where }),
  ]);
  return { items: items.map(withDisplayName), total, page: input.page, pageSize: input.pageSize };
}

export async function getUserDetail(userId: string) {
  await admin();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) throw new AdminUserError("USER_NOT_FOUND", "User not found.");
  return withDisplayName(user);
}

export async function createMember(input: CreateMemberInput) {
  await admin();
  const passwordHash = await hash(input.initialPassword);
  return prisma.$transaction(async (tx) => {
    const departments = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM departments WHERE id = ${input.departmentId}::uuid FOR SHARE`;
    if (!departments[0]) throw new AdminUserError("DEPARTMENT_NOT_FOUND", "Department not found.");
    if (!departments[0].isActive) throw new AdminUserError("DEPARTMENT_INACTIVE", "Department is inactive.");
    await ensureEmailAvailable(tx, input.email);
    const user = await tx.user.create({ data: {
      firstName: input.firstName, lastName: input.lastName, name: `${input.firstName} ${input.lastName}`,
      email: input.email, departmentId: input.departmentId, passwordHash, role: "MEMBER",
      emailVerificationRequiredAt: new Date(),
    }, select: userSelect });
    await createChallenge(tx, user.id, input.email, "REGISTRATION");
    return withDisplayName(user);
  }, { timeout: 15_000 });
}

export async function updateUserProfile(input: UpdateUserProfileInput) {
  await admin();
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE id = ${input.userId}::uuid FOR UPDATE`;
    if (!locked[0]) throw new AdminUserError("USER_NOT_FOUND", "User not found.");
    const existing = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { firstName: true, lastName: true, email: true } });
    if (input.email !== undefined && input.email !== existing.email) {
      throw new AdminUserError("EMAIL_VERIFICATION_REQUIRED", "Request and verify the new email address before updating it.");
    }
    const firstName = input.firstName ?? existing.firstName;
    const lastName = input.lastName ?? existing.lastName;
    if ((input.firstName !== undefined || input.lastName !== undefined) && (!firstName || !lastName)) {
      throw new AdminUserError("NAME_PAIR_REQUIRED", "Provide both first and last name for this legacy account.");
    }
    const user = await tx.user.update({ where: { id: input.userId }, data: {
      ...(input.firstName !== undefined || input.lastName !== undefined
        ? { firstName, lastName, name: `${firstName} ${lastName}` } : {}),
    }, select: userSelect });
    return withDisplayName(user);
  });
}

async function lockUserAndAdminCount(tx: Prisma.TransactionClient, userId: string) {
  // Match the database last-active-admin trigger's advisory lock to serialize decisions.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(618312, 4)::text`;
  const rows = await tx.$queryRaw<Array<{ id: string; role: "ADMIN" | "MEMBER"; isActive: boolean; departmentId: string | null }>>`
    SELECT id, role, "isActive", "departmentId" FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  if (!rows[0]) throw new AdminUserError("USER_NOT_FOUND", "User not found.");
  return rows[0];
}

export async function setUserRole(userId: string, role: "ADMIN" | "MEMBER") {
  const actor = await admin();
  if (actor.id === userId) throw new AdminUserError("SELF_ROLE_CHANGE", "Another admin must change your role.");
  return prisma.$transaction(async (tx) => {
    const target = await lockUserAndAdminCount(tx, userId);
    if (target.role === "ADMIN" && target.isActive && role === "MEMBER"
      && await tx.user.count({ where: { role: "ADMIN", isActive: true } }) <= 1) {
      throw new AdminUserError("LAST_ACTIVE_ADMIN", "The last active administrator cannot be demoted.");
    }
    const user = await tx.user.update({ where: { id: userId }, data: { role }, select: userSelect });
    return withDisplayName(user);
  });
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await admin();
  if (actor.id === userId && !isActive) throw new AdminUserError("SELF_DEACTIVATION", "Another admin must deactivate your account.");
  return prisma.$transaction(async (tx) => {
    const target = await lockUserAndAdminCount(tx, userId);
    if (target.role === "ADMIN" && target.isActive && !isActive
      && await tx.user.count({ where: { role: "ADMIN", isActive: true } }) <= 1) {
      throw new AdminUserError("LAST_ACTIVE_ADMIN", "The last active administrator cannot be deactivated.");
    }
    if (isActive && !target.isActive) {
      if (!target.departmentId) throw new AdminUserError("DEPARTMENT_REQUIRED", "Assign a department before activating this account.");
      const department = await tx.department.findUnique({ where: { id: target.departmentId }, select: { isActive: true } });
      if (!department?.isActive) throw new AdminUserError("DEPARTMENT_INACTIVE", "Assign an active department before activating this account.");
    }
    const user = await tx.user.update({ where: { id: userId }, data: { isActive }, select: userSelect });
    return withDisplayName(user);
  });
}
