import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.email().max(254).transform((email) => email.toLowerCase().trim()),
  password: z.string().min(1).max(1024),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: { type: "password" } },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.isActive || !user.passwordHash) return null;
        if (!(await verify(user.passwordHash, parsed.data.password))) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
});
