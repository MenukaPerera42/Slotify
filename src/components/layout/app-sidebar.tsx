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
  LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/features/auth/actions";
import { getUnreadNotificationCountAction } from "@/features/notifications/actions/notification-actions";
import { SlotifyLogo } from "./slotify-logo";
import { SlotifyIcon } from "./slotify-icon";

const baseNavigationItems = [
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
];

export function AppSidebar({ user }: { user: { name: string; email: string; role: "ADMIN" | "MEMBER" } }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const refreshUnreadCount = () => getUnreadNotificationCountAction()
      .then((res) => {
        if (isMounted && res.success && typeof res.data === "number") {
          setUnreadCount(res.data);
        }
      })
      .catch(() => {});
    void refreshUnreadCount();
    window.addEventListener("slotify:notifications-changed", refreshUnreadCount);
    return () => {
      isMounted = false;
      window.removeEventListener("slotify:notifications-changed", refreshUnreadCount);
    };
  }, [pathname]);

  const navigationItems = [
    ...baseNavigationItems,
    { name: user.role === "ADMIN" ? "Reservations" : "My Reservations", href: "/reservations", icon: CalendarDays },
    ...(user.role === "ADMIN" ? [{ name: "Administration", href: "/administration", icon: Shield }] : []),
  ];

  return (
    <>
      {/* Mobile Top Navbar */}
      <div className="lg:hidden flex items-center justify-between px-4 sm:px-5 py-2.5 bg-white border-b border-[#E5E7EB] sticky top-0 z-30 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <SlotifyIcon className="h-7 w-7" priority />
          <span className="font-extrabold text-slate-900 text-lg tracking-tight">Slotify</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="h-11 w-11 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Toggle navigation"
          aria-expanded={mobileMenuOpen}
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
          "fixed top-0 bottom-0 left-0 z-40 w-56 max-w-[85vw] h-dvh overflow-y-auto bg-white border-r border-[#E5E7EB] flex flex-col justify-between transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 shrink-0 select-none",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col">
          {/* Logo / Brand Header */}
          <div className="h-14 px-5 flex items-center">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 group translate-y-[7px]"
              onClick={() => setMobileMenuOpen(false)}
            >
              <SlotifyLogo className="w-40" priority />
            </Link>
          </div>

          {/* Navigation Links with refined 14px vertical breathing space from logo */}
          <nav className="px-3 pt-5 pb-2 space-y-1">
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
              Workspace
            </span>
          </div>

          {/* Functional Quick Actions & Notifications Links */}
          <div className="px-3 space-y-0.5 text-xs text-slate-600">
            <Link
              href="/quick-actions"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all group",
                pathname === "/quick-actions"
                  ? "bg-blue-50 text-blue-600 font-semibold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Zap
                className={cn(
                  "h-4 w-4 transition-colors",
                  pathname === "/quick-actions"
                    ? "text-blue-600"
                    : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span>Quick Actions</span>
            </Link>

            <Link
              href="/notifications"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition-all group",
                pathname === "/notifications"
                  ? "bg-blue-50 text-blue-600 font-semibold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <div className="flex items-center gap-3">
                <Bell
                  className={cn(
                    "h-4 w-4 transition-colors",
                    pathname === "/notifications"
                      ? "text-blue-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                <span>Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none shadow-2xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* User Card at bottom of sidebar matching reference */}
        <div className="p-3 px-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
              {user.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Shield className="h-2.5 w-2.5 text-blue-500" /> {user.role === "ADMIN" ? "Admin" : "Member"}
              </span>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900" title={`Sign out ${user.email}`}><LogOut className="h-3.5 w-3.5" /> Sign out</button>
          </form>
        </div>
      </aside>
    </>
  );
}
