"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/authorization";
import { consumeRateLimit } from "@/lib/auth-rate-limit";
import { emailSchema } from "@/features/auth/email-schema";
import { createChallenge, ensureEmailAvailable, resendRegistration, VerificationError, verificationResult, verifyCode } from "./service";

const uuid = z.string().uuid();
const otp = z.string().regex(/^\d{6}$/, "Enter the six-digit code.");
const registrationVerificationSchema = z.strictObject({ challengeId: uuid, code: otp });
const emailChangeSchema = z.strictObject({ userId: uuid, newEmail: emailSchema });
const emailChangeVerificationSchema = z.strictObject({ challengeId: uuid, code: otp });

function invalidInput(): never { throw new VerificationError("INVALID_INPUT", "Check the submitted fields."); }

export async function verifyRegistrationOtpAction(input: unknown) {
  return verificationResult(async () => {
    const parsed = registrationVerificationSchema.safeParse(input);
    if (!parsed.success) return invalidInput();
    return verifyCode(parsed.data.challengeId, parsed.data.code, "REGISTRATION");
  });
}

export async function resendRegistrationOtpAction(input: unknown) {
  return verificationResult(async () => {
    const email = emailSchema.safeParse(input);
    if (!email.success) return invalidInput();
    return resendRegistration(email.data);
  });
}

export async function getVerificationStateAction(input: unknown) {
  return verificationResult(async () => {
    const challengeId = uuid.safeParse(input);
    if (!challengeId.success) return invalidInput();
    const challenge = await prisma.emailVerificationChallenge.findUnique({
      where: { id: challengeId.data }, select: { id: true, purpose: true, targetEmail: true,
        expiresAt: true, lastSentAt: true, attemptsRemaining: true, consumedAt: true },
    });
    if (!challenge) throw new VerificationError("NOT_FOUND", "Verification request not found.");
    return { challengeId: challenge.id, purpose: challenge.purpose, targetEmail: challenge.targetEmail,
      expiresAt: challenge.expiresAt, resendAvailableAt: new Date(challenge.lastSentAt.getTime() + 60_000),
      attemptsRemaining: challenge.attemptsRemaining, status: challenge.consumedAt ? "CONSUMED" as const
        : challenge.expiresAt <= new Date() ? "EXPIRED" as const : "PENDING" as const };
  });
}

export async function getRegistrationVerificationStateAction(input: unknown) {
  return verificationResult(async () => {
    const email = emailSchema.safeParse(input);
    if (!email.success) return invalidInput();
    const user = await prisma.user.findUnique({ where: { email: email.data }, select: {
      id: true, emailVerifiedAt: true, emailVerificationRequiredAt: true } });
    if (!user?.emailVerificationRequiredAt || user.emailVerifiedAt) throw new VerificationError("NOT_FOUND", "No pending registration was found.");
    const challenge = await prisma.emailVerificationChallenge.findFirst({ where: {
      userId: user.id, purpose: "REGISTRATION", consumedAt: null },
      select: { id: true, expiresAt: true, lastSentAt: true, attemptsRemaining: true },
    });
    if (!challenge) throw new VerificationError("NOT_FOUND", "No pending registration was found.");
    return { challengeId: challenge.id, targetEmail: email.data, expiresAt: challenge.expiresAt,
      resendAvailableAt: new Date(challenge.lastSentAt.getTime() + 60_000),
      attemptsRemaining: challenge.attemptsRemaining,
      status: challenge.expiresAt <= new Date() ? "EXPIRED" as const : "PENDING" as const };
  });
}

async function admin() {
  const actor = await currentUser();
  if (!actor) throw new VerificationError("UNAUTHENTICATED", "Sign in to continue.");
  if (actor.role !== "ADMIN") throw new VerificationError("FORBIDDEN", "Administrator access is required.");
  return actor;
}

export async function requestAdminEmailChangeAction(input: unknown) {
  return verificationResult(async () => {
    const actor = await admin();
    const parsed = emailChangeSchema.safeParse(input);
    if (!parsed.success) return invalidInput();
    if (!(await consumeRateLimit("email-change-admin", actor.id, 10, 3600)))
      throw new VerificationError("RATE_LIMITED", "Too many email-change requests. Try again later.");
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${parsed.data.userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, email: true } });
      if (!user) throw new VerificationError("NOT_FOUND", "User not found.");
      if (user.email === parsed.data.newEmail) throw new VerificationError("INVALID_INPUT", "Choose a different email.");
      await ensureEmailAvailable(tx, parsed.data.newEmail, user.id);
      await tx.emailVerificationChallenge.updateMany({ where: { userId: user.id, purpose: "EMAIL_CHANGE", consumedAt: null }, data: { consumedAt: new Date() } });
      return createChallenge(tx, user.id, parsed.data.newEmail, "EMAIL_CHANGE", actor.id);
    }, { timeout: 15_000 });
    revalidatePath("/administration");
    return result;
  });
}

export async function verifyPendingEmailChangeAction(input: unknown) {
  return verificationResult(async () => {
    const parsed = emailChangeVerificationSchema.safeParse(input);
    if (!parsed.success) return invalidInput();
    const result = await verifyCode(parsed.data.challengeId, parsed.data.code, "EMAIL_CHANGE");
    revalidatePath("/administration");
    return result;
  });
}

export async function cancelPendingEmailChangeAction(input: unknown) {
  return verificationResult(async () => {
    const actor = await currentUser();
    if (!actor) throw new VerificationError("UNAUTHENTICATED", "Sign in to continue.");
    const userId = uuid.safeParse(input);
    if (!userId.success) return invalidInput();
    if (actor.role !== "ADMIN" && actor.id !== userId.data) throw new VerificationError("FORBIDDEN", "Access denied.");
    const result = await prisma.emailVerificationChallenge.updateMany({ where: {
      userId: userId.data, purpose: "EMAIL_CHANGE", consumedAt: null }, data: { consumedAt: new Date() } });
    revalidatePath("/administration");
    return { cancelled: result.count > 0 };
  });
}

export async function getPendingEmailChangeStateAction(input: unknown) {
  return verificationResult(async () => {
    const actor = await currentUser();
    if (!actor) throw new VerificationError("UNAUTHENTICATED", "Sign in to continue.");
    const userId = uuid.safeParse(input);
    if (!userId.success) return invalidInput();
    if (actor.role !== "ADMIN" && actor.id !== userId.data) throw new VerificationError("FORBIDDEN", "Access denied.");
    const pending = await prisma.emailVerificationChallenge.findFirst({ where: {
      userId: userId.data, purpose: "EMAIL_CHANGE", consumedAt: null },
      select: { id: true, targetEmail: true, expiresAt: true, lastSentAt: true },
    });
    return pending ? { challengeId: pending.id, targetEmail: pending.targetEmail,
      expiresAt: pending.expiresAt, resendAvailableAt: new Date(pending.lastSentAt.getTime() + 60_000),
      status: pending.expiresAt <= new Date() ? "EXPIRED" as const : "PENDING" as const } : null;
  });
}
