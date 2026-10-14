import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/authorization";
import { SlotifyLogo } from "@/components/layout/slotify-logo";
import { AuthArtPanel } from "@/components/auth/auth-art-panel";
import { VerifyEmailForm } from "./verify-email-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; challengeId?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const { email, challengeId } = await searchParams;

  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f6f7fb] overflow-x-hidden">
      {/* Left Column: Supplied Artwork (Desktop & Tablet) */}
      <section className="hidden lg:flex lg:w-[50%] xl:w-[54%] items-center justify-center bg-[#f6f7fb]">
        <AuthArtPanel />
      </section>

      {/* Right Column: Email Verification Form */}
      <section className="w-full lg:w-[50%] xl:w-[46%] bg-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 min-h-screen shadow-sm z-10 min-w-0">
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

        {/* Center: Verification Box */}
        <div className="my-auto py-6 w-full max-w-sm sm:max-w-md mx-auto space-y-6 min-w-0">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Verify your email
            </h1>
          </div>

          <VerifyEmailForm
            initialEmail={email}
            initialChallengeId={challengeId}
          />
        </div>

        {/* Bottom Footer */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>&copy; {new Date().getFullYear()} Slotify Inc. All rights reserved.</span>
        </div>
      </section>
    </main>
  );
}
