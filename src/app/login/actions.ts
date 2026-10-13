"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function loginAction(_state: string, data: FormData): Promise<string> {
  try {
    await signIn("credentials", {
      email: data.get("email"),
      password: data.get("password"),
      redirectTo: "/dashboard",
    });
    return "";
  } catch (error) {
    if (error instanceof AuthError) return "Invalid email or password.";
    throw error;
  }
}
