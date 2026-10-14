"use server";

import { hash } from "argon2";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/features/auth/email-schema";
import { passwordSchema } from "@/features/auth/password-schema";
import { clientAddress, consumeRateLimit } from "@/lib/auth-rate-limit";

const registrationSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(80),
  lastName: z.string().trim().min(1, "Enter your last name.").max(80),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  departmentId: z.string().uuid("Choose an active department."),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match.",
});

export type SignupState = { message?: string; fieldErrors?: Record<string, string[]> };
class InactiveDepartmentError extends Error {}

export async function registerMemberAction(input: unknown) {
  const address = clientAddress(await headers());
  const [addressAllowed, globalAllowed] = await Promise.all([
    consumeRateLimit("signup-address", address, 6, 60 * 60),
    consumeRateLimit("signup-global", "all", 100, 60 * 60),
  ]);
  if (!addressAllowed || !globalAllowed) {
    return { success: false as const, code: "RATE_LIMITED" as const, error: "Too many sign-up attempts. Please try again later." };
  }

  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, code: "INVALID_INPUT" as const, error: "Check the submitted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  if (!(await consumeRateLimit("signup-email", parsed.data.email, 3, 24 * 60 * 60))) {
    return { success: false as const, code: "RATE_LIMITED" as const, error: "Too many sign-up attempts. Please try again later." };
  }

  try {
    const passwordHash = await hash(parsed.data.password);
    await prisma.$transaction(async (tx) => {
      const departments = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM departments WHERE id = ${parsed.data.departmentId}::uuid AND "isActive" FOR SHARE`;
      if (!departments[0]) throw new InactiveDepartmentError();
      await tx.user.create({ data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        name: `${parsed.data.firstName} ${parsed.data.lastName}`,
        email: parsed.data.email,
        passwordHash,
        departmentId: parsed.data.departmentId,
        role: "MEMBER",
      } });
    });
    return { success: true as const, data: { email: parsed.data.email, nextPath: "/login?created=1" } };
  } catch (error) {
    if (error instanceof InactiveDepartmentError) return { success: false as const, code: "INVALID_INPUT" as const,
      error: "Choose an active department.", fieldErrors: { departmentId: ["Choose an active department."] } };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false as const, code: "EMAIL_IN_USE" as const,
        error: "An account with that email already exists." };
    }
    console.error("Registration failed:", error);
    return { success: false as const, code: "DATABASE_ERROR" as const,
      error: "Unable to create an account right now. Please try again later." };
  }
}

export async function signupAction(_state: SignupState, data: FormData): Promise<SignupState> {
  const result = await registerMemberAction({
    firstName: data.get("firstName"), lastName: data.get("lastName"), email: data.get("email"),
    password: data.get("password"), confirmPassword: data.get("confirmPassword"), departmentId: data.get("departmentId"),
  });
  if (!result.success) return { message: result.error, fieldErrors: result.fieldErrors };
  redirect(result.data.nextPath);
}
