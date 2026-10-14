import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/authorization";
import { SlotifyLogo } from "@/components/layout/slotify-logo";
import { SignupForm } from "./signup-form";
import { publicActiveDepartments } from "@/features/departments/services/department-service";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { ArrowLeft, Users } from "lucide-react";

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  const departments = await publicActiveDepartments();

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
        <div className="my-auto py-4 max-w-sm sm:max-w-md w-full mx-auto space-y-5">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              <Users className="h-3 w-3" />
              <span>Member Self-Registration</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Create your account
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Join your team on Slotify to access resource reservation timelines and collaborate across departments.
            </p>
          </div>

          <SignupForm departments={departments} />
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
          headline="Collaborative Resource Management"
          subheadline="Empower your team with real-time schedule transparency, instant collision prevention, and streamlined approval workflows."
        />
      </section>
    </main>
  );
}
