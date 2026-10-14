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
    <div className="flex-1 flex flex-col min-w-0">
      {/* Reference Page Header */}
      <header className="px-8 pt-7 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Meeting rooms
        </h1>
      </header>

      <main className="flex-1 px-8 pb-12 max-w-7xl w-full">
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
