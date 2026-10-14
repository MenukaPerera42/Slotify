import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/authorization";
import { LoginForm } from "./login-form";
import { SlotifyLogo } from "@/components/layout/slotify-logo";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const { created } = await searchParams;

  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f6f7fb]">
      {/* Left Column: Form & Interaction */}
      <section className="w-full lg:w-[48%] xl:w-[45%] bg-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 min-h-screen shadow-sm z-10">
        {/* Top Header: Logo & Return Link */}
        <div className="flex items-center justify-between pb-6 sm:pb-8">
          <Link href="/" className="inline-block transition-opacity hover:opacity-90">
            <SlotifyLogo className="w-36 sm:w-40" priority />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Home</span>
          </Link>
        </div>

        {/* Center: Auth Box */}
        <div className="my-auto py-6 max-w-sm sm:max-w-md w-full mx-auto space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              Workspace Authentication
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Enter your credentials to access your organization&apos;s resource calendar and booking timeline.
            </p>
          </div>

          {created === "1" && (
            <div
              role="status"
              className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5 shadow-2xs"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">Account Created Successfully</p>
                <p className="mt-0.5 text-emerald-700">
                  Your member credentials are ready. Please sign in below to continue.
                </p>
              </div>
            </div>
          )}

          <LoginForm />

          {/* Assessment Environment Quick Reference */}
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
              <Info className="h-3.5 w-3.5 text-blue-600" />
              <span>Assessment Access Roles</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Standard Member self-registration is enabled. Administrators maintain full approval workflows, catalog governance, and on-behalf booking capabilities.
            </p>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>&copy; {new Date().getFullYear()} Slotify Inc. All rights reserved.</span>
          <span>PrimeWave Lab Technical Assessment</span>
        </div>
      </section>

      {/* Right Column: Visual Product Showcase (Image 5 Split-Screen Reference) */}
      <section className="hidden lg:flex lg:w-[52%] xl:w-[55%] p-3 sm:p-4 bg-[#f6f7fb]">
        <AuthVisualPanel
          headline="Enterprise Resource Reservation Engine"
          subheadline="Real-time multi-department scheduling, continuous timeline visibility, and zero double-bookings backed by PostgreSQL GiST exclusion locks."
        />
      </section>
    </main>
  );
}
