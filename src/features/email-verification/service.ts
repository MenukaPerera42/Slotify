import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type EmailChallengePurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/auth-rate-limit";
import { sendVerificationEmail, EmailDeliveryError } from "./lib/email-delivery";
import { hashOtp, matchesOtp, newOtp } from "./lib/otp";

const OTP_LIFETIME_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
type Db = Prisma.TransactionClient;
export type VerificationCode =
  | "INVALID_INPUT" | "EMAIL_IN_USE" | "EMAIL_NOT_VERIFIED" | "OTP_INVALID"
  | "OTP_EXPIRED" | "OTP_ATTEMPTS_EXCEEDED" | "RESEND_COOLDOWN"
  | "RATE_LIMITED" | "EMAIL_DELIVERY_FAILED" | "EMAIL_CONFIGURATION_ERROR"
  | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "DATABASE_ERROR";
export class VerificationError extends Error {
  constructor(public readonly code: VerificationCode, message: string) { super(message); }
}

export function verificationResult<T>(work: () => Promise<T>): Promise<
  { success: true; data: T } | { success: false; code: VerificationCode; error: string; fieldErrors?: Record<string, string[]> }
> {
  return work().then((data) => ({ success: true as const, data })).catch((error: unknown) => {
    if (error instanceof VerificationError) return { success: false as const, code: error.code, error: error.message };
    if (error instanceof EmailDeliveryError) return { success: false as const, code: error.code,
      error: error.code === "EMAIL_CONFIGURATION_ERROR" ? "Email delivery is not configured. Set RESEND_API_KEY and a verified RESEND_FROM_EMAIL."
        : "Unable to send the verification email. Please try again." };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false as const, code: "EMAIL_IN_USE" as const, error: "This email is already in use or pending verification." };
    }
    console.error("Email verification operation failed", error);
    return { success: false as const, code: "DATABASE_ERROR" as const, error: "Unable to complete verification right now." };
  });
}

async function claimAvailable(tx: Db, email: string, exceptUserId?: string) {
  const now = new Date();
  await tx.emailVerificationChallenge.updateMany({ where: { purpose: "EMAIL_CHANGE", targetEmail: { equals: email, mode: "insensitive" },
    consumedAt: null, expiresAt: { lte: now } }, data: { consumedAt: now } });
  const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
  if (user && user.id !== exceptUserId) throw new VerificationError("EMAIL_IN_USE", "This email is already in use.");
  const pending = await tx.emailVerificationChallenge.findFirst({
    where: { targetEmail: { equals: email, mode: "insensitive" }, consumedAt: null,
      ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) }, select: { id: true },
  });
  if (pending) throw new VerificationError("EMAIL_IN_USE", "This email is already pending verification.");
}

export async function createChallenge(tx: Db, userId: string, email: string, purpose: EmailChallengePurpose, initiatedByUserId?: string) {
  const id = randomUUID();
  const now = new Date();
  const code = newOtp(id, 0);
  await tx.emailVerificationChallenge.create({ data: {
    id, userId, purpose, targetEmail: email, initiatedByUserId,
    codeHash: hashOtp(id, purpose, email, code),
    expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS), lastSentAt: now,
  } });
  await sendVerificationEmail(email, code, purpose);
  return { challengeId: id, targetEmail: email, expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS), resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS) };
}

export async function ensureEmailAvailable(tx: Db, email: string, exceptUserId?: string) {
  await claimAvailable(tx, email, exceptUserId);
}

export async function resendRegistration(email: string) {
  if (!(await consumeRateLimit("verification-resend-email", email, 5, 3600)))
    throw new VerificationError("RATE_LIMITED", "Too many resend requests. Try again later.");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true, emailVerificationRequiredAt: true } });
    if (!user?.emailVerificationRequiredAt || user.emailVerifiedAt) throw new VerificationError("NOT_FOUND", "No pending registration was found.");
    await tx.$queryRaw`SELECT id FROM email_verification_challenges WHERE "userId" = ${user.id}::uuid AND purpose = 'REGISTRATION' AND "consumedAt" IS NULL FOR UPDATE`;
    const challenge = await tx.emailVerificationChallenge.findFirst({ where: { userId: user.id, purpose: "REGISTRATION", consumedAt: null } });
    if (!challenge) throw new VerificationError("NOT_FOUND", "No pending registration was found.");
    const now = new Date();
    if (now.getTime() - challenge.lastSentAt.getTime() < RESEND_COOLDOWN_MS)
      throw new VerificationError("RESEND_COOLDOWN", "Wait 60 seconds before requesting another code.");
    let resendCount = challenge.resendCount + 1;
    let code = newOtp(challenge.id, resendCount);
    while (hashOtp(challenge.id, "REGISTRATION", email, code) === challenge.codeHash) {
      resendCount++;
      code = newOtp(challenge.id, resendCount);
    }
    const expiresAt = new Date(now.getTime() + OTP_LIFETIME_MS);
    await tx.emailVerificationChallenge.update({ where: { id: challenge.id }, data: {
      codeHash: hashOtp(challenge.id, "REGISTRATION", email, code), resendCount,
      attemptsRemaining: 5, lastSentAt: now, expiresAt,
    } });
    await sendVerificationEmail(email, code, "REGISTRATION");
    return { challengeId: challenge.id, targetEmail: email, expiresAt, resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS) };
  }, { timeout: 15_000 });
}

export async function verifyCode(challengeId: string, code: string, purpose: EmailChallengePurpose) {
  if (!(await consumeRateLimit("verification-attempt-challenge", challengeId, 20, 3600)))
    throw new VerificationError("RATE_LIMITED", "Too many verification attempts. Try again later.");
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM email_verification_challenges WHERE id = ${challengeId}::uuid FOR UPDATE`;
    const challenge = await tx.emailVerificationChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.purpose !== purpose || challenge.consumedAt) return { code: "OTP_INVALID" as const };
    if (challenge.expiresAt <= new Date()) return { code: "OTP_EXPIRED" as const };
    if (challenge.attemptsRemaining <= 0) return { code: "OTP_ATTEMPTS_EXCEEDED" as const };
    if (!matchesOtp(challenge.codeHash, challenge.id, purpose, challenge.targetEmail, code)) {
      await tx.emailVerificationChallenge.update({ where: { id: challenge.id }, data: { attemptsRemaining: { decrement: 1 } } });
      return { code: challenge.attemptsRemaining === 1 ? "OTP_ATTEMPTS_EXCEEDED" as const : "OTP_INVALID" as const };
    }
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${challenge.userId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: challenge.userId } });
    if (!user) return { code: "NOT_FOUND" as const };
    if (purpose === "REGISTRATION") {
      if (user.email !== challenge.targetEmail || user.emailVerifiedAt) return { code: "OTP_INVALID" as const };
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), role: "MEMBER" } });
    } else {
      if (user.email !== challenge.targetEmail) {
        try { await claimAvailable(tx, challenge.targetEmail, user.id); }
        catch (error) {
          if (error instanceof VerificationError && error.code === "EMAIL_IN_USE") return { code: "EMAIL_IN_USE" as const };
          throw error;
        }
      }
      await tx.user.update({ where: { id: user.id }, data: {
        email: challenge.targetEmail, emailVerifiedAt: new Date(),
        emailVerificationRequiredAt: user.emailVerificationRequiredAt ?? new Date(),
        sessionVersion: { increment: 1 },
      } });
    }
    await tx.emailVerificationChallenge.updateMany({ where: { userId: user.id, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
    return { userId: user.id, email: challenge.targetEmail };
  });
  if (outcome.code) throw new VerificationError(outcome.code, {
    OTP_INVALID: "The verification code is invalid or already used.", OTP_EXPIRED: "The verification code has expired.",
    OTP_ATTEMPTS_EXCEEDED: "Too many incorrect codes. Request a new code.", NOT_FOUND: "Account not found.",
    EMAIL_IN_USE: "This email is already in use.",
  }[outcome.code]);
  return outcome;
}
