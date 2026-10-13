import { getResources, getCategories } from "@/features/resources/services/resource-service";
import { ResourceCard } from "@/features/resources/components/resource-card";
import { ResourceToolbar } from "@/features/resources/components/resource-toolbar";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Layers } from "lucide-react";

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
  const params = await searchParams;
  const categories = await getCategories();
  const resources = await getResources({
    search: params.search,
    categoryId: params.categoryId,
    status: params.status || "ALL",
  });

  return (
    <>
      <AppHeader
        title="Resources Catalog"
        description="Organize conference rooms, workstations, and high-performance laboratory equipment."
      />

      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Filter and Action Toolbar */}
        <ResourceToolbar
          categories={categories}
          selectedCategory={params.categoryId || "ALL"}
          selectedStatus={params.status || "ALL"}
          searchQuery={params.search || ""}
        />

        {/* Resources Grid */}
        {resources.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="No resources found"
            description={
              params.search || (params.categoryId && params.categoryId !== "ALL") || params.status !== "ALL"
                ? "No resources match your active search or filter criteria. Try resetting filters."
                : "No resources have been registered in the system yet. Click 'Add Resource' to get started."
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                categories={categories}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
