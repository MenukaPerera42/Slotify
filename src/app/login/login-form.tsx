"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import Link from "next/link";

export function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, "");
  return <form action={action} className="space-y-4">
    <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">Email
      <input id="login-email" name="email" type="email" autoComplete="username" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />
    </label>
    <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password
      <input id="login-password" name="password" type="password" autoComplete="current-password" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />
    </label>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
    <p className="text-center text-sm text-slate-500">New to Slotify? <Link href="/signup" className="font-semibold text-blue-600 hover:underline">Sign Up</Link></p>
  </form>;
}
