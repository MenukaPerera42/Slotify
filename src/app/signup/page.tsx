import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/authorization";
import { SlotifyLogo } from "@/components/layout/slotify-logo";
import { SignupForm } from "./signup-form";
import { publicActiveDepartments } from "@/features/departments/services/department-service";
import { AuthArtPanel } from "@/components/auth/auth-art-panel";

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  const departments = await publicActiveDepartments();

  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f6f7fb]">
      {/* Left Column: Supplied Artwork (Desktop & Tablet) */}
      <section className="hidden lg:flex lg:w-[50%] xl:w-[54%] items-center justify-center bg-[#f6f7fb]">
        <AuthArtPanel />
      </section>

      {/* Right Column: Compact Sign Up Form */}
      <section className="w-full lg:w-[50%] xl:w-[46%] bg-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 xl:p-12 min-h-screen shadow-sm z-10 overflow-y-auto">
        {/* Top Header: Logo linking to / (No Home button) */}
        <div className="flex items-center pb-4 sm:pb-6">
          <Link
            href="/"
            aria-label="Slotify Home"
            className="inline-block transition-opacity hover:opacity-90"
          >
            <SlotifyLogo className="w-36 sm:w-40" priority />
          </Link>
        </div>

        {/* Center: Auth Box */}
        <div className="my-auto py-2 max-w-sm sm:max-w-md w-full mx-auto space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Create an account
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Join your team to access resource schedules and booking timelines.
            </p>
          </div>

          <SignupForm departments={departments} />
        </div>

        {/* Bottom Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>&copy; {new Date().getFullYear()} Slotify Inc. All rights reserved.</span>
        </div>
      </section>
    </main>
  );
}
