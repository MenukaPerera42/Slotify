import Link from "next/link";
import { Poppins } from "next/font/google";
import { currentUser } from "@/lib/authorization";
import { SlotifyLogo } from "@/components/layout/slotify-logo";
import {
  CalendarDays,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Layers,
  CheckCircle2,
  Bell,
  Users,
  Building2,
  Check,
  CalendarCheck,
} from "lucide-react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default async function HomePage() {
  const user = await currentUser();

  return (
    <div
      className={`${poppins.className} min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white`}
    >
      {/* 1. STICKY TOP NAVIGATION */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center transition-opacity hover:opacity-95"
              aria-label="Slotify Home"
            >
              <SlotifyLogo className="w-36 sm:w-40" priority />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a
                href="#features"
                className="hover:text-blue-600 transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="hover:text-blue-600 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#roles"
                className="hover:text-blue-600 transition-colors"
              >
                Roles &amp; Governance
              </a>
              <Link
                href="/resources"
                className="hover:text-blue-600 transition-colors"
              >
                Resource Catalog
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-all"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-all"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 bg-gradient-to-b from-white via-slate-50 to-[#f8fafc]">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
            {/* Minimal Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Modern Workplace Scheduling</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.14]">
              Resource Scheduling Built for{" "}
              <span className="text-blue-600 bg-clip-text">High-Performance Teams</span>
            </h1>

            {/* Required Clean Subtitle */}
            <p className="text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Find and reserve meeting rooms, workspaces, and shared equipment in one simple place. Keep your team organized with clear schedules and effortless booking.
            </p>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              {user ? (
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm sm:text-base font-semibold text-white shadow-md hover:bg-blue-700 transition-all"
                >
                  <span>Open Your Dashboard</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm sm:text-base font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              )}
              <Link
                href="/resources"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-300 px-6 py-3.5 text-sm sm:text-base font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                <Layers className="h-4 w-4 text-slate-500" />
                <span>Browse Resource Catalog</span>
              </Link>
            </div>

            {/* Trust / Benefit Bar (Clean Business Language) */}
            <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Conflict-Free</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Automated schedule protection</p>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>Real-Time View</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Instant availability grid</p>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <span>Team Workspaces</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Organized by department</p>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-amber-600" />
                  <span>Fast Approvals</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Seamless manager review</p>
              </div>
            </div>

            {/* Visual Timeline Product Preview */}
            <div className="pt-10 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden text-left">
                {/* Browser Frame Top Bar */}
                <div className="bg-slate-100/80 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-slate-200 text-xs font-mono text-slate-500 max-w-xs sm:max-w-md w-full justify-center">
                    <CalendarCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span>slotify.primewave.local/resources</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live Schedule</span>
                  </div>
                </div>

                {/* Mockup Header: Date & Department Selector */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-blue-600" />
                      <span>Resource Availability Timeline</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Viewing schedule for today (Asia/Colombo UTC+05:30)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold">
                      All Resources
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium">
                      Engineering
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium">
                      Executive
                    </span>
                  </div>
                </div>

                {/* Mockup Timeline Grid */}
                <div className="p-4 sm:p-6 space-y-4 overflow-x-auto">
                  {/* Timeline Time Scale */}
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-mono text-slate-400 pb-1 border-b border-slate-100 min-w-[600px]">
                    <div className="col-span-3 text-slate-500 font-sans font-semibold">Resource</div>
                    <div className="col-span-1 text-center">08:00</div>
                    <div className="col-span-1 text-center">09:00</div>
                    <div className="col-span-1 text-center">10:00</div>
                    <div className="col-span-1 text-center">11:00</div>
                    <div className="col-span-1 text-center">12:00</div>
                    <div className="col-span-1 text-center">13:00</div>
                    <div className="col-span-1 text-center">14:00</div>
                    <div className="col-span-1 text-center">15:00</div>
                    <div className="col-span-1 text-center">16:00</div>
                  </div>

                  {/* Resource 1 */}
                  <div className="grid grid-cols-12 gap-1 items-center min-w-[600px] group">
                    <div className="col-span-3 pr-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        Grand Horizon Boardroom
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        Room A-101 • Capacity 16
                      </p>
                    </div>
                    <div className="col-span-9 h-10 bg-slate-50 rounded-lg border border-slate-200/70 relative flex items-center">
                      <div className="absolute left-[11%] right-[55%] h-7 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 flex items-center justify-between text-[10px] font-semibold shadow-xs">
                        <span className="truncate">Engineering Standup</span>
                        <span className="text-[9px] opacity-80 shrink-0">Approved</span>
                      </div>
                    </div>
                  </div>

                  {/* Resource 2 */}
                  <div className="grid grid-cols-12 gap-1 items-center min-w-[600px] group">
                    <div className="col-span-3 pr-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        Quantum Computing Lab
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        Lab B-204 • Capacity 8
                      </p>
                    </div>
                    <div className="col-span-9 h-10 bg-slate-50 rounded-lg border border-slate-200/70 relative flex items-center">
                      <div className="absolute left-[44%] right-[22%] h-7 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-2 flex items-center justify-between text-[10px] font-semibold shadow-xs">
                        <span className="truncate">Product Demo Session</span>
                        <span className="text-[9px] opacity-80 shrink-0">Approved</span>
                      </div>
                    </div>
                  </div>

                  {/* Resource 3 */}
                  <div className="grid grid-cols-12 gap-1 items-center min-w-[600px] group">
                    <div className="col-span-3 pr-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        Acoustic Studio A
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        Studio S-01 • Capacity 4
                      </p>
                    </div>
                    <div className="col-span-9 h-10 bg-slate-50 rounded-lg border border-slate-200/70 relative flex items-center">
                      <div className="absolute left-[22%] right-[66%] h-7 rounded-md bg-amber-500 text-white px-2 flex items-center justify-between text-[10px] font-semibold shadow-xs">
                        <span className="truncate">Team Podcast</span>
                        <span className="text-[9px] opacity-80 shrink-0">Pending</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mockup Footer */}
                <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      Engineering
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      Research &amp; Design
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Pending Approval
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 break-words">
                    Slotify Resource Management
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. VALUE PILLARS: WHAT IS SLOTIFY */}
        <section id="features" className="py-20 bg-white border-t border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Why Teams Choose Slotify
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Built for Clarity, Speed, and Simplicity
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Shared calendars cause accidental overlaps and meeting confusion. Slotify keeps your workplace organized with visual schedules and transparent access.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Pillar 1 */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all space-y-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  Conflict-Free Booking
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatic schedule verification prevents double-bookings before they happen, keeping reservations reliable for everyone.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all space-y-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  Interactive Timelines
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Clear visual blocks make it easy to see room and equipment availability across days and hours at a single glance.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  Department Workspaces
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Group facilities by department to simplify team access, track usage, and manage shared office assets efficiently.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all space-y-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <Bell className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  Instant Notifications
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Stay updated with instant in-app alerts whenever a reservation is submitted, approved, or rescheduled.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. HOW IT WORKS (4 SIMPLE STEPS) */}
        <section id="how-it-works" className="py-20 bg-[#f8fafc] border-t border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Simple Booking Flow
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                How Reservation Scheduling Works
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Book the spaces and equipment you need in four easy steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <span className="inline-flex h-8 w-8 rounded-lg bg-blue-600 text-white font-extrabold items-center justify-center text-xs">
                  01
                </span>
                <h3 className="font-bold text-base text-slate-900">Browse Catalog</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Explore available meeting rooms, labs, and equipment filtered by department, capacity, and current status.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <span className="inline-flex h-8 w-8 rounded-lg bg-blue-600 text-white font-extrabold items-center justify-center text-xs">
                  02
                </span>
                <h3 className="font-bold text-base text-slate-900">Select Time Slot</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pick your target date and time duration directly on the interactive timeline grid.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <span className="inline-flex h-8 w-8 rounded-lg bg-blue-600 text-white font-extrabold items-center justify-center text-xs">
                  03
                </span>
                <h3 className="font-bold text-base text-slate-900">Instant Check</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The schedule engine instantly validates your chosen time window to guarantee no conflicting reservations exist.
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <span className="inline-flex h-8 w-8 rounded-lg bg-blue-600 text-white font-extrabold items-center justify-center text-xs">
                  04
                </span>
                <h3 className="font-bold text-base text-slate-900">Manage &amp; Update</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Receive instant notifications, track your active bookings, and make changes whenever your plans evolve.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. ROLE-BASED GOVERNANCE (MEMBER VS ADMIN) */}
        <section id="roles" className="py-20 bg-white border-t border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Tailored Access
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Designed for Members and Administrators
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Give employees self-service booking freedom while giving workplace managers complete administrative control.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Member Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs hover:border-slate-300 transition-all space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Standard Access
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                      Team Members
                    </h3>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <Users className="h-5 w-5" />
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Fast self-service booking for engineers, researchers, and project leads needing rooms or lab equipment.
                </p>

                <ul className="space-y-3 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Browse available meeting rooms and workspaces with real-time schedules</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Reserve convenient time slots directly on the visual timeline</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Track personal reservations and manage upcoming bookings in one place</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Receive instant notifications on reservation updates and approvals</span>
                  </li>
                </ul>

                <div className="pt-2">
                  <Link
                    href="/signup"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-200 transition-all"
                  >
                    <span>Register as Member</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Admin Card */}
              <div className="rounded-2xl border-2 border-blue-600/30 bg-gradient-to-b from-blue-50/40 via-white to-white p-7 shadow-md space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                      Workplace Management
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                      System Administrators
                    </h3>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Full control over facility schedules, approval queues, departmental resource setups, and user accounts.
                </p>

                <ul className="space-y-3 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Centralized approval dashboard with quick confirmation tools</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Create, update, and manage resources, shifts, and departments</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Reserve resources on behalf of team members when required</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Review detailed reservation logs and manage user permissions</span>
                  </li>
                </ul>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-xs"
                  >
                    <span>Sign In to Admin Portal</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. CALL TO ACTION BANNER */}
        <section className="py-16 bg-[#f8fafc]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-8 sm:p-14 text-white text-center relative overflow-hidden shadow-2xl border border-blue-900/40">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto space-y-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-blue-200">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  <span>Start Scheduling Today</span>
                </span>

                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Ready to eliminate reservation chaos?
                </h2>

                <p className="text-sm sm:text-base text-blue-200/80 leading-relaxed">
                  Join teams utilizing Slotify for predictable, conflict-free resource scheduling with continuous timeline visualization.
                </p>

                <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/signup"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-500 transition-all"
                  >
                    <span>Create Member Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-all"
                  >
                    <span>Sign In</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 7. MINIMAL MARKETING FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-100">
            <div className="space-y-2">
              <SlotifyLogo className="w-36" />
              <p className="text-xs text-slate-500 max-w-sm">
                Resource Reservation Management System. Built for seamless team scheduling.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
              <a href="#features" className="hover:text-blue-600 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors">
                How It Works
              </a>
              <a href="#roles" className="hover:text-blue-600 transition-colors">
                Roles &amp; Governance
              </a>
              <Link href="/resources" className="hover:text-blue-600 transition-colors">
                Catalog
              </Link>
              <Link href="/login" className="hover:text-blue-600 transition-colors">
                Sign In
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
            <span>
              &copy; {new Date().getFullYear()} Slotify Inc. All rights reserved.
            </span>
            <span>
              Resource Reservation Management System
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
