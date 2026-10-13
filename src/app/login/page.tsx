import { redirect } from "next/navigation";
import { currentUser } from "@/lib/authorization";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");
  return <main className="min-h-screen bg-[#f6f7fb] flex items-center justify-center px-5">
    <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-8"><span className="h-3 w-3 rounded-full bg-blue-600" /><h1 className="text-xl font-extrabold tracking-tight">Slotify</h1></div>
      <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
      <p className="mt-2 mb-7 text-sm text-slate-500">Access your resource workspace.</p>
      <LoginForm />
    </section>
  </main>;
}
