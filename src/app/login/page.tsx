import { redirect } from "next/navigation";
import { currentUser } from "@/lib/authorization";
import { LoginForm } from "./login-form";
import { SlotifyLogo } from "@/components/layout/slotify-logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  if (await currentUser()) redirect("/dashboard");
  const { created } = await searchParams;
  return <main className="min-h-screen bg-[#f6f7fb] flex items-center justify-center px-5 py-8">
    <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <SlotifyLogo className="w-44 mb-5" priority />
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mt-2 mb-7 text-sm text-slate-500">Access your resource workspace.</p>
      {created === "1" && <p role="status" className="mb-5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Account created. Sign in to continue.</p>}
      <LoginForm />
    </section>
  </main>;
}
