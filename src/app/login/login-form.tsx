"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, "");
  return <form action={action} className="space-y-4">
    <label className="block text-sm font-medium text-slate-700">Email
      <input name="email" type="email" autoComplete="username" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />
    </label>
    <label className="block text-sm font-medium text-slate-700">Password
      <input name="password" type="password" autoComplete="current-password" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />
    </label>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}
