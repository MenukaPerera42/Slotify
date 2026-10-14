"use client";

import {
  Clock,
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  Sparkles,
  Layers,
} from "lucide-react";

interface AuthVisualPanelProps {
  headline?: string;
  subheadline?: string;
}

export function AuthVisualPanel({
  headline = "Smart Workspace Scheduling",
  subheadline = "Coordinate conference rooms, lab hardware, and collaborative spaces with zero scheduling conflicts.",
}: AuthVisualPanelProps) {
  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-8 sm:p-12 flex flex-col justify-between text-white shadow-2xl border border-blue-900/40 select-none">
      {/* Background Ambient Lighting & Grid */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top Header / Branding Tag */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-semibold text-blue-200">
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          <span>Slotify Smart Engine</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-blue-200/80">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real-Time Engine</span>
        </div>
      </div>

      {/* Central Visual Composition: Layered Booking & Schedule Cards */}
      <div className="relative z-10 my-auto py-8 space-y-4 max-w-md mx-auto w-full">
        {/* Main Floating Card: Scheduled Meeting Room */}
        <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl p-5 shadow-2xl space-y-4 transition-transform duration-300 hover:scale-[1.01]">
          {/* Card Top: Room title & Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white tracking-tight">
                  Grand Horizon Boardroom (A-101)
                </h4>
                <p className="text-[11px] text-blue-200/70">
                  Meeting Rooms • Building A, 1st Floor
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" />
              Approved
            </span>
          </div>

          {/* Timeline Mini Bar: Continuous Block Visualization */}
          <div className="p-3 rounded-xl bg-slate-950/40 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-blue-200 font-semibold">
                <Clock className="h-3.5 w-3.5 text-blue-400" />
                09:30 AM – 11:30 AM
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Asia/Colombo (UTC+05:30)
              </span>
            </div>

            {/* Visual Timeline Bar with Time Markers */}
            <div className="relative h-6 bg-slate-800/80 rounded-lg overflow-hidden border border-slate-700/60 flex items-center px-1">
              <div
                className="absolute top-1 bottom-1 left-[25%] right-[35%] rounded bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-between px-2 text-[9px] font-bold text-white shadow-xs"
              >
                <span>ENG</span>
                <span className="text-[8px] opacity-80">2.0 hrs</span>
              </div>
            </div>

            <div className="flex justify-between text-[9px] text-slate-400 font-mono px-0.5">
              <span>09:00</span>
              <span>10:00</span>
              <span>11:00</span>
              <span>12:00</span>
              <span>13:00</span>
            </div>
          </div>

          {/* Department & Participants Info */}
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
            <div className="flex items-center gap-1.5 text-blue-200">
              <Users className="h-3.5 w-3.5 text-blue-400" />
              <span className="font-medium text-[11px]">
                Engineering Department
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Capacity:</span>
              <span className="text-[10px] font-bold text-white px-1.5 py-0.2 rounded bg-white/10">
                16 People
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Floating Feature Chips */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">
                Zero Overlaps
              </p>
              <p className="text-[9px] text-blue-200/60 truncate">
                PostgreSQL GiST protection
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">
                Department Scoped
              </p>
              <p className="text-[9px] text-blue-200/60 truncate">
                Organizational tracking
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Copywriting Storytelling */}
      <div className="relative z-10 space-y-2 max-w-md">
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
          {headline}
        </h3>
        <p className="text-xs sm:text-sm text-blue-200/80 leading-relaxed">
          {subheadline}
        </p>
      </div>
    </div>
  );
}
