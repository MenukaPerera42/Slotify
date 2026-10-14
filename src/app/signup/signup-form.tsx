"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type SignupState } from "./actions";

const initialState: SignupState = {};

export function SignupForm({ departments }: { departments: { id: string; name: string; code: string }[] }) {
  const [state, action, pending] = useActionState(signupAction, initialState);
  return <form action={action} className="space-y-4">
    <label htmlFor="signup-name" className="block text-sm font-medium text-slate-700">Full Name</label>
    <input id="signup-name" name="name" type="text" autoComplete="name" required maxLength={80} aria-describedby={state.fieldErrors?.name ? "signup-name-error" : undefined} className="-mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />
    {state.fieldErrors?.name && <p id="signup-name-error" className="text-xs text-rose-600">{state.fieldErrors.name[0]}</p>}

    <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700">Email Address</label>
    <input id="signup-email" name="email" type="email" autoComplete="email" required maxLength={254} aria-describedby={state.fieldErrors?.email ? "signup-email-error" : undefined} className="-mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />
    {state.fieldErrors?.email && <p id="signup-email-error" className="text-xs text-rose-600">Enter a valid email address.</p>}

    <label htmlFor="signup-department" className="block text-sm font-medium text-slate-700">Department</label>
    <select id="signup-department" name="departmentId" required defaultValue="" aria-describedby={state.fieldErrors?.departmentId ? "signup-department-error" : undefined} className="-mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600">
      <option value="" disabled>Choose a department</option>
      {departments.map((department) => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}
    </select>
    {state.fieldErrors?.departmentId && <p id="signup-department-error" className="text-xs text-rose-600">{state.fieldErrors.departmentId[0]}</p>}

    <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700">Password</label>
    <input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} aria-describedby="signup-password-help" className="-mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />
    <p id="signup-password-help" className="text-xs text-slate-500">Minimum 6 characters. 8+ characters recommended for stronger security.</p>
    {state.fieldErrors?.password && <p className="text-xs text-rose-600">{state.fieldErrors.password[0]}</p>}

    <label htmlFor="signup-confirm" className="block text-sm font-medium text-slate-700">Confirm Password</label>
    <input id="signup-confirm" name="confirmPassword" type="password" autoComplete="new-password" required aria-describedby={state.fieldErrors?.confirmPassword ? "signup-confirm-error" : undefined} className="-mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />
    {state.fieldErrors?.confirmPassword && <p id="signup-confirm-error" className="text-xs text-rose-600">{state.fieldErrors.confirmPassword[0]}</p>}

    {state.message && <p role="alert" className="text-sm text-rose-600">{state.message}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{pending ? "Creating account…" : "Create Account"}</button>
    <p className="text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-blue-600 hover:underline">Back to Login</Link></p>
  </form>;
}
