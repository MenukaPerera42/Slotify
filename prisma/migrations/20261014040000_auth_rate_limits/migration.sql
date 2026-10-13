CREATE TABLE "auth_rate_limits" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "attempts" INTEGER NOT NULL,
  "resetAt" TIMESTAMPTZ(3) NOT NULL
);

CREATE INDEX "auth_rate_limits_resetAt_idx" ON "auth_rate_limits"("resetAt");
CREATE UNIQUE INDEX "users_email_lower_key" ON "users"(lower("email"));
