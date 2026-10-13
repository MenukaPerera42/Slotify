"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  CalendarDays,
  Menu,
  X,
  Shield,
  Zap,
  Bell,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Resources",
    href: "/resources",
    icon: Layers,
  },
  {
    name: "Reservations",
    href: "/reservations",
    icon: CalendarDays,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Navbar */}
      <div className="lg:hidden flex items-center justify-between px-5 py-3.5 bg-white border-b border-[#E5E7EB] sticky top-0 z-30">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
            <span className="h-3 w-3 rounded-full bg-blue-600 -ml-1"></span>
          </div>
          <span className="font-bold text-slate-900 tracking-tight text-lg">
            Slotify
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-2xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop Sticky + Mobile Drawer) */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 w-56 bg-white border-r border-[#E5E7EB] flex flex-col justify-between transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 shrink-0 select-none",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col">
          {/* Logo / Brand Header */}
          <div className="h-14 px-5 flex items-center">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 group"
              onClick={() => setMobileMenuOpen(false)}
            >
              {/* Reference-style geometric dot cluster icon */}
              <div className="flex items-center -space-x-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                <span className="h-3.5 w-3.5 rounded-full bg-blue-600"></span>
                <span className="h-2 w-2 rounded-full bg-blue-400"></span>
              </div>
              <span className="font-extrabold text-slate-900 text-xl tracking-tight ml-1.5">
                Slotify
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group",
                    isActive
                      ? "bg-blue-50 text-blue-600 font-semibold shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isActive
                        ? "text-blue-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Section Divider matching reference */}
          <div className="px-5 py-2">
            <div className="h-px bg-slate-100" />
            <span className="text-[10px] font-semibold tracking-wider text-slate-300 uppercase block mt-2">
              Assessment Scope
            </span>
          </div>

          <div className="px-3 space-y-0.5 text-xs text-slate-400">
            <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl text-slate-400 select-none">
              <Zap className="h-4 w-4 text-slate-300" />
              <span>Quick Actions</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl text-slate-400 select-none">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-slate-300" />
                <span>Notifications</span>
              </div>
              <span className="h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                3
              </span>
            </div>
          </div>
        </div>

        {/* User Card at bottom of sidebar matching reference */}
        <div className="p-3 px-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
              AV
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate">
                Alex Vance
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Shield className="h-2.5 w-2.5 text-blue-500" /> Demo Admin
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
