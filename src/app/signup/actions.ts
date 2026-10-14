"use server";

import { hash } from "argon2";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/features/auth/email-schema";
import { passwordSchema } from "@/features/auth/password-schema";
import { clientAddress, consumeRateLimit } from "@/lib/auth-rate-limit";

const registrationSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80, "Name is too long."),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match.",
});

export type SignupState = { message?: string; fieldErrors?: Record<string, string[]> };

export async function signupAction(_state: SignupState, data: FormData): Promise<SignupState> {
  const address = clientAddress(await headers());
  const [addressAllowed, globalAllowed] = await Promise.all([
    consumeRateLimit("signup-address", address, 6, 60 * 60),
    consumeRateLimit("signup-global", "all", 100, 60 * 60),
  ]);
  if (!addressAllowed || !globalAllowed) {
    return { message: "Too many sign-up attempts. Please try again later." };
  }

  const parsed = registrationSchema.safeParse({
    name: data.get("name"),
    email: data.get("email"),
    password: data.get("password"),
    confirmPassword: data.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  if (!(await consumeRateLimit("signup-email", parsed.data.email, 3, 24 * 60 * 60))) {
    return { message: "Unable to create an account with these details. Try signing in or use another email." };
  }

  try {
    const passwordHash = await hash(parsed.data.password);
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "MEMBER",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "Unable to create an account with these details. Try signing in or use another email." };
    }
    return { message: "Unable to create an account right now. Please try again later." };
  }

  redirect("/login?created=1");
}
