"use client";

import { useActionState, useState } from "react";
import { loginAction } from "./actions";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";

export function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, "");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-700 flex items-start gap-2.5"
        >
          <span className="font-semibold shrink-0 mt-0.5">Notice:</span>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="login-email"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2"
        >
          Work Email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="h-4 w-4" />
          </div>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="name@company.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            Password
          </label>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="h-4 w-4" />
          </div>
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60 transition-all duration-150 flex items-center justify-center gap-2 mt-3.5"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Signing in…</span>
          </>
        ) : (
          <>
            <span>Sign In</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="pt-4 text-center">
        <p className="text-xs text-slate-500">
          New to Slotify?{" "}
          <Link
            href="/signup"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}
