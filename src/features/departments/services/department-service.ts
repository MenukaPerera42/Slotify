import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { DepartmentError } from "../types";
import { departmentListSchema, usersByDepartmentSchema, type CreateDepartmentInput, type UpdateDepartmentInput } from "../schemas/department-schema";

async function actor() {
  const user = await currentUser();
  if (!user) throw new DepartmentError("UNAUTHENTICATED", "Sign in with an active account to continue.");
  return user;
}
async function admin() {
  const user = await actor();
  if (user.role !== "ADMIN") throw new DepartmentError("FORBIDDEN", "Administrator access is required.");
  return user;
}

export async function publicActiveDepartments() {
  return prisma.department.findMany({
    where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" },
  });
}

export async function getMyDepartment() {
  const user = await actor();
  const department = user.departmentId
    ? await prisma.department.findUnique({ where: { id: user.departmentId }, select: { id: true, name: true, code: true, isActive: true } })
    : null;
  return { department, assignmentRequired: !department?.isActive };
}

export async function listDepartments(input: z.output<typeof departmentListSchema>) {
  await admin();
  const where: Prisma.DepartmentWhereInput = {
    ...(input.status === "ACTIVE" ? { isActive: true } : input.status === "INACTIVE" ? { isActive: false } : {}),
    ...(input.search ? { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { code: { contains: input.search, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.department.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.department.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function createDepartment(input: CreateDepartmentInput) {
  await admin();
  return prisma.department.create({ data: input });
}

export async function updateDepartment(id: string, input: UpdateDepartmentInput) {
  await admin();
  const existing = await prisma.department.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new DepartmentError("DEPARTMENT_NOT_FOUND", "Department not found.");
  return prisma.department.update({ where: { id }, data: input });
}

export async function setDepartmentStatus(id: string, isActive: boolean) {
  await admin();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM departments WHERE id = ${id}::uuid FOR UPDATE`;
    if (!rows[0]) throw new DepartmentError("DEPARTMENT_NOT_FOUND", "Department not found.");
    if (!isActive && await tx.user.count({ where: { departmentId: id, isActive: true } }) > 0) {
      throw new DepartmentError("DEPARTMENT_IN_USE", "Reassign active users before deactivating this department.");
    }
    return tx.department.update({ where: { id }, data: { isActive } });
  });
}

export async function assignUserDepartment(userId: string, departmentId: string) {
  await admin();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM departments WHERE id = ${departmentId}::uuid FOR SHARE`;
    if (!rows[0]) throw new DepartmentError("DEPARTMENT_NOT_FOUND", "Department not found.");
    if (!rows[0].isActive) throw new DepartmentError("DEPARTMENT_INACTIVE", "Department is inactive.");
    const result = await tx.user.updateMany({ where: { id: userId }, data: { departmentId } });
    if (!result.count) throw new DepartmentError("USER_NOT_FOUND", "User not found.");
    return tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, isActive: true, departmentId: true } });
  });
}

export async function listUsersByDepartment(input: z.output<typeof usersByDepartmentSchema>) {
  await admin();
  const department = await prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
  if (!department) throw new DepartmentError("DEPARTMENT_NOT_FOUND", "Department not found.");
  const where = { departmentId: input.departmentId };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true, isActive: true, departmentId: true }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}
