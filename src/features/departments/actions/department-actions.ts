"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignUserDepartmentSchema, createDepartmentSchema, departmentIdSchema,
  departmentListSchema, setDepartmentStatusSchema, updateDepartmentSchema, usersByDepartmentSchema,
} from "../schemas/department-schema";
import { DepartmentError, type DepartmentResult } from "../types";
import {
  assignUserDepartment, createDepartment, getMyDepartment, listDepartments,
  listUsersByDepartment, publicActiveDepartments, setDepartmentStatus, updateDepartment,
} from "../services/department-service";

async function run<T>(work: () => Promise<T>): Promise<DepartmentResult<T>> {
  try { return { success: true, data: await work() }; }
  catch (error) {
    if (error instanceof z.ZodError) return { success: false, code: "INVALID_INPUT", error: "Check the submitted fields.", fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
    if (error instanceof DepartmentError) return { success: false, code: error.code, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, code: "DEPARTMENT_CONFLICT", error: "A department with that name or code already exists." };
    console.error("Department operation failed:", error);
    return { success: false, code: "DATABASE_ERROR", error: "Unable to complete the department operation." };
  }
}

function refresh() {
  revalidatePath("/administration");
  revalidatePath("/signup");
  revalidatePath("/reservations");
}

export async function listSignupDepartmentsAction() {
  return run(() => publicActiveDepartments());
}
export async function getMyDepartmentAction() {
  return run(() => getMyDepartment());
}
export async function listDepartmentsAction(input: unknown = {}) {
  return run(() => listDepartments(departmentListSchema.parse(input)));
}
export async function listActiveDepartmentsAction(input: unknown = {}) {
  return run(() => listDepartments({ ...departmentListSchema.parse(input), status: "ACTIVE" }));
}
export async function createDepartmentAction(input: unknown) {
  return run(async () => { const item = await createDepartment(createDepartmentSchema.parse(input)); refresh(); return item; });
}
export async function updateDepartmentAction(id: unknown, input: unknown) {
  return run(async () => { const item = await updateDepartment(departmentIdSchema.parse(id), updateDepartmentSchema.parse(input)); refresh(); return item; });
}
export async function setDepartmentStatusAction(input: unknown) {
  return run(async () => { const parsed = setDepartmentStatusSchema.parse(input); const item = await setDepartmentStatus(parsed.id, parsed.isActive); refresh(); return item; });
}
export async function assignUserDepartmentAction(input: unknown) {
  return run(async () => { const parsed = assignUserDepartmentSchema.parse(input); const item = await assignUserDepartment(parsed.userId, parsed.departmentId); refresh(); return item; });
}
export async function listUsersByDepartmentAction(input: unknown) {
  return run(() => listUsersByDepartment(usersByDepartmentSchema.parse(input)));
}
