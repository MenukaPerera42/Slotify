"use server";

// Temporary compatibility exports for the existing admin form. Stage 7C.4A
// removed email verification; these actions send no mail and mutate no data.
// The next frontend stage should call updateUserProfileAction for email edits
// and remove this module with the obsolete OTP controls.
type LegacyResult<T> =
  | { success: true; data: T }
  | { success: false; code: "VERIFICATION_DISABLED"; error: string };

type PendingEmailChange = {
  challengeId: string;
  targetEmail: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  status: "PENDING" | "EXPIRED";
};

function unavailable<T>(): LegacyResult<T> {
  return { success: false, code: "VERIFICATION_DISABLED",
    error: "Email verification is no longer required. Save the email through the profile update action." };
}

export async function requestAdminEmailChangeAction(input: unknown): Promise<LegacyResult<PendingEmailChange>> {
  void input;
  return unavailable();
}

export async function verifyPendingEmailChangeAction(input: unknown): Promise<LegacyResult<{ userId: string; email: string }>> {
  void input;
  return unavailable();
}

export async function cancelPendingEmailChangeAction(input: unknown): Promise<LegacyResult<{ cancelled: boolean }>> {
  void input;
  return unavailable();
}

export async function getPendingEmailChangeStateAction(input: unknown): Promise<LegacyResult<PendingEmailChange | null>> {
  void input;
  return unavailable();
}
