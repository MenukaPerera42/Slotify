import { redirect } from "next/navigation";
import { currentUser } from "@/lib/authorization";
import { SlotifyLogo } from "@/components/layout/slotify-logo";
import { SignupForm } from "./signup-form";
import { publicActiveDepartments } from "@/features/departments/services/department-service";

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  const departments = await publicActiveDepartments();
  return <main className="min-h-screen bg-[#f6f7fb] flex items-center justify-center px-5 py-8">
    <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <SlotifyLogo className="w-44 mb-5" priority />
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-2 mb-7 text-sm text-slate-500">Join your resource workspace as a member.</p>
      <SignupForm departments={departments} />
    </section>
  </main>;
}
