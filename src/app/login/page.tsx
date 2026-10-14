import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/authorization";
import { LoginForm } from "./login-form";
import { SlotifyLogo } from "@/components/layout/slotify-logo";
import { AuthArtPanel } from "@/components/auth/auth-art-panel";
import { CheckCircle2 } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; verified?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const { created, verified } = await searchParams;

  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f6f7fb]">
      {/* Left Column: Supplied Artwork (Desktop & Tablet) */}
      <section className="hidden lg:flex lg:w-[50%] xl:w-[54%] items-center justify-center bg-[#f6f7fb]">
        <AuthArtPanel />
      </section>

      {/* Right Column: Clean, Minimal Login Form */}
      <section className="w-full lg:w-[50%] xl:w-[46%] bg-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 min-h-screen shadow-sm z-10">
        {/* Top Header: Logo linking to / (No Home button) */}
        <div className="flex items-center pb-6 sm:pb-8">
          <Link
            href="/"
            aria-label="Slotify Home"
            className="inline-block transition-opacity hover:opacity-90"
          >
            <SlotifyLogo className="w-36 sm:w-40" priority />
          </Link>
        </div>

        {/* Center: Minimal Auth Box */}
        <div className="my-auto py-6 max-w-sm sm:max-w-md w-full mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome Back
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Enter your credentials to access your organization&apos;s workspace.
            </p>
          </div>

          {(created === "1" || verified === "1") && (
            <div
              role="status"
              className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5 shadow-2xs"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">
                  {verified === "1"
                    ? "Email Verified Successfully"
                    : "Account Created Successfully"}
                </p>
                <p className="mt-0.5 text-emerald-700">
                  {verified === "1"
                    ? "Your email has been verified. Please sign in below to continue."
                    : "Your member credentials are ready. Please sign in below to continue."}
                </p>
              </div>
            </div>
          )}

          <LoginForm />
        </div>

        {/* Bottom Footer */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>&copy; {new Date().getFullYear()} Slotify Inc. All rights reserved.</span>
        </div>
      </section>
    </main>
  );
}
