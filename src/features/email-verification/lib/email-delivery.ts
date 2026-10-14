import "server-only";

export class EmailDeliveryError extends Error {
  constructor(public readonly code: "EMAIL_CONFIGURATION_ERROR" | "EMAIL_DELIVERY_FAILED") {
    super(code);
  }
}

export async function sendVerificationEmail(to: string, code: string, purpose: "REGISTRATION" | "EMAIL_CHANGE") {
  if (process.env.SLOTIFY_RESERVATION_TEST_MODE === "1" && process.env.SLOTIFY_EMAIL_TEST_MODE === "1") {
    if (to.startsWith("fail-")) throw new EmailDeliveryError("EMAIL_DELIVERY_FAILED");
    return;
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)
    || from.endsWith(".local") || from.endsWith("@resend.dev")) {
    throw new EmailDeliveryError("EMAIL_CONFIGURATION_ERROR");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Slotify <${from}>`,
      to: [to],
      subject: purpose === "REGISTRATION" ? "Verify your Slotify email" : "Confirm your Slotify email change",
      text: `Your Slotify verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => { throw new EmailDeliveryError("EMAIL_DELIVERY_FAILED"); });
  if (!response.ok) throw new EmailDeliveryError("EMAIL_DELIVERY_FAILED");
}
