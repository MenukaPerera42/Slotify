import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

type RateLimitRow = { attempts: number };

function keyFor(scope: string, identity: string) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required for authentication.");
  return createHmac("sha256", process.env.AUTH_SECRET).update(`${scope}:${identity}`).digest("hex");
}

export function clientAddress(headers: Headers) {
  // Deploy behind a proxy that overwrites forwarded headers. Account and global
  // limits still apply if the address is absent or the header is untrusted.
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")?.trim()
    || "unknown";
}

export async function consumeRateLimit(
  scope: string,
  identity: string,
  maxAttempts: number,
  windowSeconds: number,
) {
  // Keep the small assessment database from retaining expired anonymous keys.
  if (Math.random() < 0.01) {
    await prisma.authRateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  }
  const key = keyFor(scope, identity);
  const [row] = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "auth_rate_limits" ("key", "attempts", "resetAt")
    VALUES (${key}, 1, now() + (${windowSeconds} * interval '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "auth_rate_limits"."resetAt" <= now()
        THEN 1 ELSE "auth_rate_limits"."attempts" + 1 END,
      "resetAt" = CASE WHEN "auth_rate_limits"."resetAt" <= now()
        THEN now() + (${windowSeconds} * interval '1 second')
        ELSE "auth_rate_limits"."resetAt" END
    RETURNING "attempts"
  `;
  return row.attempts <= maxAttempts;
}
