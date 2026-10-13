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
  CalendarCheck2,
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
      {/* Mobile Menu Button (Floating / Top Bar) */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-2xs">
            <CalendarCheck2 className="h-4 w-4" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight text-base">
            Slotify
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-2xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Content (Desktop Sticky + Mobile Drawer) */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div>
          {/* Brand Header */}
          <div className="h-16 px-6 flex items-center border-b border-slate-100">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 group"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs group-hover:bg-blue-700 transition-colors">
                <CalendarCheck2 className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-lg leading-tight tracking-tight">
                  Slotify
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  Resource Manager
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Management
            </div>
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                    isActive
                      ? "bg-blue-50/80 text-blue-700 font-semibold shadow-2xs"
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
        </div>

        {/* Demo User Badge & Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs">
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
            <div className="mt-2 text-[10px] text-slate-400 italic">
              MVP assessment context
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

