import { getResources, getCategories } from "@/features/resources/services/resource-service";
import { AvailabilityCard } from "@/features/resources/components/availability-card";
import { TimelineGrid } from "@/features/resources/components/timeline-grid";
import { ResourceToolbar } from "@/features/resources/components/resource-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { Layers } from "lucide-react";
import { requireUser } from "@/lib/authorization";

interface ResourcesPageProps {
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    status?: "ALL" | "ACTIVE" | "INACTIVE";
  }>;
}

export default async function ResourcesPage({
  searchParams,
}: ResourcesPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const categories = await getCategories();
  const resources = await getResources({
    search: params.search,
    categoryId: params.categoryId,
    status: params.status || "ALL",
  });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Reference Page Header */}
      <header className="px-8 pt-7 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Meeting rooms
        </h1>
      </header>

      <main className="flex-1 px-8 pb-12 space-y-6 max-w-7xl w-full">
        {/* Toolbar: View Tabs + Date Strip Bar + Filters */}
        <ResourceToolbar
          categories={categories}
          canManage={user.role === "ADMIN"}
          selectedCategory={params.categoryId || "ALL"}
          selectedStatus={params.status || "ALL"}
          searchQuery={params.search || ""}
        />

        {/* Timeline Grid matching reference middle section */}
        {resources.length > 0 && (
          <div className="space-y-3">
            <TimelineGrid resources={resources} />
          </div>
        )}

        {/* Bottom Section: Availability Cards matching reference */}
        <div className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Meeting room availability
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {resources.length} resources found
            </span>
          </div>

          {resources.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="No resources found"
              description="No resources match your active search or category filters. Try adjusting your filter parameters."
            />
          ) : (
            <div className="space-y-3">
              {resources.map((resource) => (
                <AvailabilityCard
                  key={resource.id}
                  resource={resource}
                  categories={categories}
                  canManage={user.role === "ADMIN"}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
