

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
    <header className="px-8 pt-7 pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-7xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
