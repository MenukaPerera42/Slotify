import { getResources, getCategories } from "@/features/resources/services/resource-service";
import { ResourcesPageClient } from "@/features/resources/components/resources-page-client";
import { requireUser } from "@/lib/authorization";
import { resourceQuerySchema } from "@/features/resources/schemas/resource-schema";
import { publicActiveDepartments } from "@/features/departments/services/department-service";

export const metadata = {
  title: "Resources | Slotify",
  description: "Browse organizational resources, view occupancy, and reserve slots.",
};

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
  const filters = resourceQuerySchema.safeParse(params);
  const query = filters.success ? filters.data : resourceQuerySchema.parse({});
  const categories = await getCategories();
  const resources = await getResources(query);
  const departments = await publicActiveDepartments();

  return (
    <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-clip">
      {/* Reference Page Header */}
      <header className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-7 pb-4 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Resource Management
        </h1>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
          Discover, manage, and reserve shared workspaces, meeting rooms, and equipment.
        </p>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-12 max-w-7xl w-full min-w-0">
        <ResourcesPageClient
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }}
          resources={resources}
          categories={categories}
          departments={departments}
          selectedCategory={query.categoryId || "ALL"}
          selectedStatus={query.status}
          searchQuery={query.search || ""}
        />
      </main>
    </div>
  );
}
