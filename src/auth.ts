import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { hash, verify } from "argon2";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/features/auth/email-schema";
import { clientAddress, consumeRateLimit } from "@/lib/auth-rate-limit";

const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(1024),
});
const dummyHash = hash(randomBytes(32).toString("base64url"));

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (user) token.sessionVersion = user.sessionVersion ?? 0;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      session.sessionVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: { type: "password" } },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const address = clientAddress(request.headers);
        const [emailAllowed, addressAllowed, globalAllowed] = await Promise.all([
          consumeRateLimit("login-email", parsed.data.email, 8, 15 * 60),
          consumeRateLimit("login-address", address, 30, 15 * 60),
          consumeRateLimit("login-global", "all", 300, 15 * 60),
        ]);
        if (!emailAllowed || !addressAllowed || !globalAllowed) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        const hashToCheck = user?.passwordHash ?? await dummyHash;
        const validPassword = await verify(hashToCheck, parsed.data.password);
        if (!user?.isActive || !user.passwordHash || !validPassword
          || (user.emailVerificationRequiredAt && !user.emailVerifiedAt)) return null;
        return { id: user.id, name: user.name, email: user.email, sessionVersion: user.sessionVersion };
      },
    }),
  ],
});
