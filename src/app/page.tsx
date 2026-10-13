import Link from "next/link";
import {
  CalendarDays,
  Layers,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xs sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-2xs">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <span className="font-semibold text-lg text-slate-900 tracking-tight">
                Slotify
              </span>
              <span className="ml-2 text-xs font-medium uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                Stage 3 Ready
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/resources">
              <Button size="sm" className="flex items-center gap-1.5 shadow-xs">
                <span>Enter System</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Resource Reservation Management System</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Professional Resource Management
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Architected for reliable resource scheduling, conflict-free
            reservations, and real-time organizational availability tracking.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/resources">
              <Button size="lg" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <span>Explore Resource Catalog</span>
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="flex items-center gap-2">
                <span>View Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Foundation Architecture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">
              Resource Catalog
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Complete catalog management with category filters, full-text search,
              and soft deactivation.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">
              Reservation Engine
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Predictable time-slot scheduling backed by PostgreSQL exclusion
              locking.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">
              Zero-Overlap Integrity
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Database GiST exclusion constraints guarantee race-free booking
              isolation.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>PrimeWave Lab Technical Assessment — Slotify</span>
          <span>Stage 3 Completed • Resource Management & Application Shell</span>
        </div>
      </footer>
    </main>
  );
}
