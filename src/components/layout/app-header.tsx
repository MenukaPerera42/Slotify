

interface AppHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export function AppHeader({
  title,
  description,
  badge,
  action,
}: AppHeaderProps) {
  return (
    <header className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-7 pb-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-7xl">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 break-words min-w-0">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          )}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2 min-w-0">{action}</div>}
      </div>
    </header>
  );
}
