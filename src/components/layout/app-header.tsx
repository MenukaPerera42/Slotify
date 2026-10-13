import { ShieldCheck } from "lucide-react";

interface AppHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AppHeader({ title, description, action }: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200/90 px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/70 text-[11px] font-medium text-blue-700">
              <ShieldCheck className="h-3 w-3" /> PrimeWave Lab
            </span>
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
