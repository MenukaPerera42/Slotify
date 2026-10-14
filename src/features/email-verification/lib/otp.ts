import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { EmailChallengePurpose } from "@prisma/client";

const otpSecret = () => {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required for email verification.");
  return process.env.AUTH_SECRET;
};
const testMode = () => process.env.SLOTIFY_RESERVATION_TEST_MODE === "1"
  && process.env.SLOTIFY_EMAIL_TEST_MODE === "1";

export function newOtp(challengeId: string, resendCount: number) {
  if (testMode()) {
    const digest = createHmac("sha256", otpSecret())
      .update(`slotify-mock-otp:${challengeId}:${resendCount}`).digest("hex");
    return (BigInt(`0x${digest}`) % BigInt(1_000_000)).toString().padStart(6, "0");
  }
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(id: string, purpose: EmailChallengePurpose, email: string, code: string) {
  return createHmac("sha256", otpSecret())
    .update(`slotify-email-otp:v1:${id}:${purpose}:${email}:${code}`).digest("hex");
}

export function matchesOtp(expectedHash: string, id: string, purpose: EmailChallengePurpose, email: string, code: string) {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hashOtp(id, purpose, email, code), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
