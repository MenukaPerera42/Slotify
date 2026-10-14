"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { signupAction, type SignupState } from "./actions";
import {
  Eye,
  EyeOff,
  User,
  Mail,
  Building2,
  Lock,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const initialState: SignupState = {};

export function SignupForm({
  departments,
}: {
  departments: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(signupAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (state.verification?.nextPath) {
      router.push(state.verification.nextPath);
    }
  }, [state.verification, router]);

  return (
    <form action={action} className="space-y-3">
      {state.message && (
        <div
          role="alert"
          className={`rounded-xl p-2.5 text-xs flex items-start gap-2 ${
            state.verification
              ? "bg-emerald-50 border border-emerald-200/80 text-emerald-800"
              : "bg-rose-50 border border-rose-200/80 text-rose-700"
          }`}
        >
          <span className="font-semibold shrink-0">
            {state.verification ? "Success:" : "Notice:"}
          </span>
          <span>{state.message}</span>
        </div>
      )}

      {/* First & Last Name side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor="signup-first-name"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            First Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <User className="h-3.5 w-3.5" />
            </div>
            <input
              id="signup-first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              maxLength={80}
              placeholder="First name"
              aria-describedby={
                state.fieldErrors?.firstName
                  ? "signup-first-name-error"
                  : undefined
              }
              className={`w-full rounded-xl border ${
                state.fieldErrors?.firstName
                  ? "border-rose-300 bg-rose-50/30"
                  : "border-slate-200 bg-slate-50/50"
              } pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100`}
            />
          </div>
          {state.fieldErrors?.firstName && (
            <p id="signup-first-name-error" className="text-[11px] text-rose-600 mt-0.5">
              {state.fieldErrors.firstName[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="signup-last-name"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            Last Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <User className="h-3.5 w-3.5" />
            </div>
            <input
              id="signup-last-name"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              maxLength={80}
              placeholder="Last name"
              aria-describedby={
                state.fieldErrors?.lastName
                  ? "signup-last-name-error"
                  : undefined
              }
              className={`w-full rounded-xl border ${
                state.fieldErrors?.lastName
                  ? "border-rose-300 bg-rose-50/30"
                  : "border-slate-200 bg-slate-50/50"
              } pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100`}
            />
          </div>
          {state.fieldErrors?.lastName && (
            <p id="signup-last-name-error" className="text-[11px] text-rose-600 mt-0.5">
              {state.fieldErrors.lastName[0]}
            </p>
          )}
        </div>
      </div>

      {/* Work Email */}
      <div>
        <label
          htmlFor="signup-email"
          className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
        >
          Work Email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="h-3.5 w-3.5" />
          </div>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="name@company.com"
            aria-describedby={
              state.fieldErrors?.email ? "signup-email-error" : undefined
            }
            className={`w-full rounded-xl border ${
              state.fieldErrors?.email
                ? "border-rose-300 bg-rose-50/30"
                : "border-slate-200 bg-slate-50/50"
            } pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100`}
          />
        </div>
        {state.fieldErrors?.email && (
          <p id="signup-email-error" className="text-[11px] text-rose-600 mt-0.5">
            {state.fieldErrors.email[0] || "Enter a valid email address."}
          </p>
        )}
      </div>

      {/* Department Dropdown */}
      <div>
        <label
          htmlFor="signup-department"
          className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
        >
          Department
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <select
            id="signup-department"
            name="departmentId"
            required
            defaultValue=""
            aria-describedby={
              state.fieldErrors?.departmentId
                ? "signup-department-error"
                : undefined
            }
            className={`w-full rounded-xl border ${
              state.fieldErrors?.departmentId
                ? "border-rose-300 bg-rose-50/30"
                : "border-slate-200 bg-slate-50/50"
            } pl-8 pr-7 py-1.5 text-xs text-slate-900 outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 appearance-none`}
          >
            <option value="" disabled>
              Select your department…
            </option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name} ({department.code})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 text-[10px]">
            ▼
          </div>
        </div>
        {state.fieldErrors?.departmentId && (
          <p id="signup-department-error" className="text-[11px] text-rose-600 mt-0.5">
            {state.fieldErrors.departmentId[0]}
          </p>
        )}
      </div>

      {/* Password with Show/Hide */}
      <div>
        <label
          htmlFor="signup-password"
          className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
        >
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="h-3.5 w-3.5" />
          </div>
          <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={128}
            placeholder="At least 6 characters"
            aria-describedby="signup-password-help"
            className={`w-full rounded-xl border ${
              state.fieldErrors?.password
                ? "border-rose-300 bg-rose-50/30"
                : "border-slate-200 bg-slate-50/50"
            } pl-8 pr-9 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p id="signup-password-help" className="text-[10px] text-slate-500 mt-0.5">
          Min 6 characters, including a letter, number, and special character. (8+ recommended)
        </p>
        {state.fieldErrors?.password && (
          <p className="text-[11px] text-rose-600 mt-0.5">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {/* Confirm Password with Show/Hide */}
      <div>
        <label
          htmlFor="signup-confirm"
          className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
        >
          Confirm Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
          <input
            id="signup-confirm"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder="Repeat password"
            aria-describedby={
              state.fieldErrors?.confirmPassword
                ? "signup-confirm-error"
                : undefined
            }
            className={`w-full rounded-xl border ${
              state.fieldErrors?.confirmPassword
                ? "border-rose-300 bg-rose-50/30"
                : "border-slate-200 bg-slate-50/50"
            } pl-8 pr-9 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={
              showConfirmPassword ? "Hide password" : "Show password"
            }
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {state.fieldErrors?.confirmPassword && (
          <p id="signup-confirm-error" className="text-[11px] text-rose-600 mt-0.5">
            {state.fieldErrors.confirmPassword[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60 transition-all duration-150 flex items-center justify-center gap-2 mt-3"
      >
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Creating account…</span>
          </>
        ) : (
          <>
            <span>Create Account</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </>
        )}
      </button>

      <div className="pt-1.5 text-center">
        <p className="text-xs text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}
