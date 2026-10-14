"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/authorization";
import {
  activateOfficeShiftSchema, createOfficeShiftSchema, effectiveSchedulingHoursSchema,
  officeShiftIdSchema, updateOfficeShiftSchema,
} from "../schemas/office-shift-schema";
import { OfficeShiftError, type OfficeShiftResult } from "../types";
import {
  activateOfficeShift, createOfficeShift, getEffectiveSchedulingHours, getOfficeSchedulingConfiguration,
  listOfficeShifts, previewOfficeShiftActivation, updateOfficeShift,
} from "../services/office-shift-service";

async function run<T>(work: () => Promise<T>, adminOnly = false): Promise<OfficeShiftResult<T>> {
  try {
    const actor = await currentUser();
    if (!actor) throw new OfficeShiftError("UNAUTHENTICATED", "Sign in with an active account to continue.");
    if (adminOnly && actor.role !== "ADMIN") throw new OfficeShiftError("FORBIDDEN", "Administrator access is required.");
    return { success: true, data: await work() };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, code: "INVALID_INPUT", error: "Check the submitted fields.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
    if (error instanceof OfficeShiftError) return { success: false, code: error.code, error: error.message, impact: error.impact };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, code: "SHIFT_NAME_CONFLICT", error: "A shift with that name already exists." };
    }
    console.error("Office shift operation failed:", error);
    return { success: false, code: "DATABASE_ERROR", error: "Unable to complete the scheduling operation." };
  }
}

function refresh() {
  for (const path of ["/administration", "/resources", "/reservations", "/dashboard"]) revalidatePath(path);
}
export async function getOfficeSchedulingConfigurationAction() {
  return run(() => getOfficeSchedulingConfiguration(), true);
}
export async function listOfficeShiftsAction() {
  return run(() => listOfficeShifts(), true);
}
export async function createOfficeShiftAction(input: unknown) {
  return run(async () => { const result = await createOfficeShift(createOfficeShiftSchema.parse(input)); refresh(); return result; }, true);
}
export async function updateOfficeShiftAction(input: unknown) {
  return run(async () => { const result = await updateOfficeShift(updateOfficeShiftSchema.parse(input)); refresh(); return result; }, true);
}
export async function previewOfficeShiftActivationAction(shiftId: unknown) {
  return run(() => previewOfficeShiftActivation(officeShiftIdSchema.parse(shiftId)), true);
}
export async function activateOfficeShiftAction(input: unknown) {
  return run(async () => { const result = await activateOfficeShift(activateOfficeShiftSchema.parse(input)); refresh(); return result; }, true);
}
export async function enableFullDaySchedulingAction(input: unknown) {
  return run(async () => { const result = await activateOfficeShift(activateOfficeShiftSchema.parse(input), true); refresh(); return result; }, true);
}
export async function getEffectiveSchedulingHoursAction(input: unknown) {
  return run(() => getEffectiveSchedulingHours(effectiveSchedulingHoursSchema.parse(input)));
}
