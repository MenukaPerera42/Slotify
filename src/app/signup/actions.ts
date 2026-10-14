"use server";

import { hash } from "argon2";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/features/auth/email-schema";
import { passwordSchema } from "@/features/auth/password-schema";
import { clientAddress, consumeRateLimit } from "@/lib/auth-rate-limit";
import { createChallenge, ensureEmailAvailable, VerificationError, verificationResult } from "@/features/email-verification/service";

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

export type SignupState = { message?: string; fieldErrors?: Record<string, string[]>; verification?: { email: string; nextPath: string; challengeId: string } };

export async function registerUnverifiedMemberAction(input: unknown) {
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
    return { success: false as const, code: "INVALID_INPUT" as const, error: "Check the submitted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  if (!(await consumeRateLimit("signup-email", parsed.data.email, 3, 24 * 60 * 60))) {
    return { success: false as const, code: "RATE_LIMITED" as const, error: "Too many sign-up attempts. Please try again later." };
  }

  return verificationResult(async () => {
    const passwordHash = await hash(parsed.data.password);
    const challenge = await prisma.$transaction(async (tx) => {
      const departments = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM departments WHERE id = ${parsed.data.departmentId}::uuid AND "isActive" FOR SHARE`;
      if (!departments[0]) throw new VerificationError("INVALID_INPUT", "Choose an active department.");
      await ensureEmailAvailable(tx, parsed.data.email);
      const user = await tx.user.create({
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          name: `${parsed.data.firstName} ${parsed.data.lastName}`,
          email: parsed.data.email,
          passwordHash,
          departmentId: parsed.data.departmentId,
          role: "MEMBER",
          emailVerificationRequiredAt: new Date(),
        },
      });
      return createChallenge(tx, user.id, user.email, "REGISTRATION");
    }, { timeout: 15_000 });
    return { email: parsed.data.email, challengeId: challenge.challengeId, nextPath: `/verify-email?email=${encodeURIComponent(parsed.data.email)}&challengeId=${challenge.challengeId}`, expiresAt: challenge.expiresAt, resendAvailableAt: challenge.resendAvailableAt };
  });
}

export async function signupAction(_state: SignupState, data: FormData): Promise<SignupState> {
  const result = await registerUnverifiedMemberAction({
    firstName: data.get("firstName"), lastName: data.get("lastName"), email: data.get("email"),
    password: data.get("password"), confirmPassword: data.get("confirmPassword"), departmentId: data.get("departmentId"),
  });
  if (!result.success) return { message: result.error,
    fieldErrors: result.error === "Choose an active department." ? { departmentId: [result.error] } : result.fieldErrors };
  return { message: "Account created. Check your email for the verification code.",
    verification: { email: result.data.email, challengeId: result.data.challengeId, nextPath: result.data.nextPath } };
}
