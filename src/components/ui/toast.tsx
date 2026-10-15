"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);

      // Auto-dismiss after 4.5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast Notification Container in bottom-right corner */}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed inset-x-3 sm:inset-x-auto sm:right-5 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 max-w-md sm:w-auto pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-auto rounded-xl border p-3.5 shadow-lg bg-white flex items-start gap-3 transition-all animate-in slide-in-from-bottom-2 duration-200 select-none",
              t.type === "success" && "border-emerald-200 bg-white shadow-emerald-500/5",
              t.type === "error" && "border-rose-200 bg-white shadow-rose-500/5",
              t.type === "info" && "border-blue-200 bg-white shadow-blue-500/5"
            )}
          >
            {t.type === "success" && (
              <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            )}
            {t.type === "error" && (
              <div className="h-7 w-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
            )}
            {t.type === "info" && (
              <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Info className="h-4 w-4" />
              </div>
            )}

            <div className="min-w-0 flex-1 pt-0.5">
              {t.title && (
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {t.title}
                </p>
              )}
              <p
                className={cn(
                  "text-xs leading-relaxed break-words [overflow-wrap:anywhere]",
                  t.title ? "text-slate-600 mt-0.5" : "text-slate-800 font-medium"
                )}
              >
                {t.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-md shrink-0 -mr-1 -mt-1"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  const success = React.useCallback(
    (message: string, title?: string) => {
      context.showToast({ type: "success", message, title });
    },
    [context]
  );

  const error = React.useCallback(
    (message: string, title?: string) => {
      context.showToast({ type: "error", message, title });
    },
    [context]
  );

  const info = React.useCallback(
    (message: string, title?: string) => {
      context.showToast({ type: "info", message, title });
    },
    [context]
  );

  return {
    ...context,
    success,
    error,
    info,
  };
}
