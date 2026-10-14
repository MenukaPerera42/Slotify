"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/authorization";
import {
  createMemberSchema, listUsersSchema, setUserActiveSchema, setUserRoleSchema,
  updateUserProfileSchema, userIdSchema,
} from "../schemas/admin-user-schema";
import { AdminUserError, type AdminUserResult } from "../types";
import { EmailDeliveryError } from "@/features/email-verification/lib/email-delivery";
import { VerificationError } from "@/features/email-verification/service";
import { createMember, getUserDetail, listUsers, setUserActive, setUserRole, updateUserProfile } from "../services/admin-user-service";

async function run<T>(work: () => Promise<T>): Promise<AdminUserResult<T>> {
  try {
    const actor = await currentUser();
    if (!actor) throw new AdminUserError("UNAUTHENTICATED", "Sign in with an active account to continue.");
    if (actor.role !== "ADMIN") throw new AdminUserError("FORBIDDEN", "Administrator access is required.");
    return { success: true, data: await work() };
  }
  catch (error) {
    if (error instanceof z.ZodError) return { success: false, code: "INVALID_INPUT", error: "Check the submitted fields.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
    if (error instanceof AdminUserError) return { success: false, code: error.code, error: error.message };
    if (error instanceof VerificationError && error.code === "EMAIL_IN_USE") return { success: false, code: "EMAIL_CONFLICT", error: error.message };
    if (error instanceof EmailDeliveryError) return { success: false, code: error.code,
      error: error.code === "EMAIL_CONFIGURATION_ERROR" ? "Email delivery is not configured. Set RESEND_API_KEY and a verified RESEND_FROM_EMAIL."
        : "Unable to send the verification email. Try again later." };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, code: "EMAIL_CONFLICT", error: "An account with that email already exists." };
    }
    console.error("Admin user operation failed:", error);
    return { success: false, code: "DATABASE_ERROR", error: "Unable to complete the user operation." };
  }
}

function refresh() {
  revalidatePath("/administration");
  revalidatePath("/dashboard");
  revalidatePath("/reservations");
}

export async function listManagedUsersAction(input: unknown = {}) {
  return run(() => listUsers(listUsersSchema.parse(input)));
}
export async function getManagedUserAction(userId: unknown) {
  return run(() => getUserDetail(userIdSchema.parse(userId)));
}
export async function createMemberAction(input: unknown) {
  return run(async () => { const result = await createMember(createMemberSchema.parse(input)); refresh(); return result; });
}
export async function updateUserProfileAction(input: unknown) {
  return run(async () => { const result = await updateUserProfile(updateUserProfileSchema.parse(input)); refresh(); return result; });
}
export async function setUserRoleAction(input: unknown) {
  return run(async () => { const parsed = setUserRoleSchema.parse(input); const result = await setUserRole(parsed.userId, parsed.role); refresh(); return result; });
}
export async function setUserActiveAction(input: unknown) {
  return run(async () => { const parsed = setUserActiveSchema.parse(input); const result = await setUserActive(parsed.userId, parsed.isActive); refresh(); return result; });
}
