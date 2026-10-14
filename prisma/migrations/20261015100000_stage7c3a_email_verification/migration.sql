-- Legacy accounts retain their existing sign-in access without claiming their
-- historical addresses were verified. New accounts explicitly set requiredAt.
ALTER TABLE "users"
  ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(3),
  ADD COLUMN "emailVerificationRequiredAt" TIMESTAMPTZ(3),
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "EmailChallengePurpose" AS ENUM ('REGISTRATION', 'EMAIL_CHANGE');

CREATE TABLE "email_verification_challenges" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL,
  "initiatedByUserId" UUID,
  "purpose" "EmailChallengePurpose" NOT NULL,
  "targetEmail" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "attemptsRemaining" INTEGER NOT NULL DEFAULT 5,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "email_challenges_attempts_check" CHECK ("attemptsRemaining" BETWEEN 0 AND 5),
  CONSTRAINT "email_challenges_resends_check" CHECK ("resendCount" >= 0),
  CONSTRAINT "email_challenges_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "email_challenges_initiator_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "email_challenges_user_purpose_created_idx" ON "email_verification_challenges"("userId", "purpose", "createdAt");
CREATE INDEX "email_challenges_targetEmail_idx" ON "email_verification_challenges"("targetEmail");
CREATE UNIQUE INDEX "email_challenges_one_active_purpose_key"
  ON "email_verification_challenges"("userId", "purpose") WHERE "consumedAt" IS NULL;
CREATE UNIQUE INDEX "email_challenges_one_active_email_claim_key"
  ON "email_verification_challenges"(lower("targetEmail")) WHERE "consumedAt" IS NULL;
