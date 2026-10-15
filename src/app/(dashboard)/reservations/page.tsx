import { Suspense } from "react";
import { requireUser } from "@/lib/authorization";
import { listReservations } from "@/features/reservations/services/reservation-service";
import { getResources, getCategories } from "@/features/resources/services/resource-service";
import { reservationListSchema } from "@/features/reservations/schemas/reservation-schema";
import { ReservationsClient } from "@/features/reservations/components/reservations-client";
import { publicActiveDepartments } from "@/features/departments/services/department-service";
import { reservationSummary } from "@/features/dashboard/services/dashboard-analytics-service";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Reservations | Slotify",
  description: "Resource reservations and booking calendar.",
};

export default async function ReservationsPage() {
  const user = await requireUser();
  const categories = await getCategories();
  const rawResources = await getResources();
  const departments = await publicActiveDepartments();
  const summary = await reservationSummary();

  // Map resources to expected shape
  const resources = rawResources.map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    capacity: r.capacity,
    isActive: r.isActive,
    category: r.category ? { name: r.category.name } : null,
  }));

  // Fetch reservations based on user role
  const listParams = reservationListSchema.parse({
    page: 1,
    pageSize: 100,
    sort: "desc",
  });

  const { items: rawReservations } = await listReservations(
    listParams,
    user.role === "ADMIN" ? "all" : "own"
  );

  // If ADMIN, fetch pending reservations queue
  let rawPending: typeof rawReservations = [];
  if (user.role === "ADMIN") {
    const pendingParams = reservationListSchema.parse({
      page: 1,
      pageSize: 100,
      sort: "desc",
      status: "PENDING",
    });
    const pendingResult = await listReservations(pendingParams, "all");
    rawPending = pendingResult.items;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 max-w-full">
      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-7 pb-12 max-w-7xl w-full min-w-0">
        <Suspense
          fallback={
            <div className="p-12 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-xs">Loading reservations...</span>
            </div>
          }
        >
          <ReservationsClient
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            }}
            resources={resources}
            categories={categories}
            departments={departments}
            reservations={rawReservations}
            pendingReservations={rawPending}
            summary={summary}
          />
        </Suspense>
      </main>
    </div>
  );
}
