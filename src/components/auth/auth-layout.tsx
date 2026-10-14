import Link from "next/link";
import Image from "next/image";
import { SlotifyLogo } from "@/components/layout/slotify-logo";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen w-full bg-white flex flex-col justify-between overflow-x-hidden">
      {/* Top Header: Fixed position Slotify logo linking to / */}
      <header className="w-full px-6 sm:px-10 lg:px-14 xl:px-16 pt-6 sm:pt-8 pb-2 flex items-center justify-between shrink-0 z-10">
        <Link
          href="/"
          aria-label="Slotify Home"
          className="inline-block transition-opacity hover:opacity-90"
        >
          <SlotifyLogo className="w-36 sm:w-40" priority />
        </Link>
      </header>

      {/* Main Grid: Shared fixed structure across Login and Signup */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-16 grid grid-cols-1 lg:grid-cols-2 items-center gap-8 lg:gap-12 xl:gap-16 py-4 sm:py-6">
        {/* Left Column: Supplied PNG illustration (same position, size, and aspect ratio) */}
        <section className="hidden lg:flex items-center justify-center select-none pointer-events-none">
          <div className="relative w-full max-w-[420px] xl:max-w-[480px] aspect-square flex items-center justify-center">
            <Image
              src="/login page.png"
              alt="Slotify Workspace Management Illustration"
              width={2000}
              height={2000}
              priority
              className="w-full h-auto object-contain max-h-[68vh]"
            />
          </div>
        </section>

        {/* Right Column: Clean form container */}
        <section className="w-full max-w-sm sm:max-w-md mx-auto lg:mx-0 lg:ml-auto min-w-0">
          {children}
        </section>
      </div>

      {/* Bottom Footer */}
      <footer className="w-full px-6 sm:px-10 lg:px-14 xl:px-16 py-4 flex items-center justify-center lg:justify-between text-[11px] text-slate-400 shrink-0 border-t border-slate-100">
        <span>&copy; {new Date().getFullYear()} Slotify Inc. All rights reserved.</span>
      </footer>
    </main>
  );
}

