import { AppHeader } from "@/components/layout/app-header";
import { Suspense } from "react";
import { requireUser } from "@/lib/authorization";
import { listReservations } from "@/features/reservations/services/reservation-service";
import { getResources, getCategories } from "@/features/resources/services/resource-service";
import { reservationListSchema } from "@/features/reservations/schemas/reservation-schema";
import { ReservationsClient } from "@/features/reservations/components/reservations-client";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Reservations | Slotify",
  description: "Resource reservations and booking calendar.",
};

export default async function ReservationsPage() {
  const user = await requireUser();
  const { items: reservations } = await listReservations({ page: 1, pageSize: 100, sort: "desc" }, user.role === "ADMIN" ? "all" : "own");
  return <>
    <AppHeader title={user.role === "ADMIN" ? "Reservations" : "My Reservations"} description="Reservation history and current status. Booking requests arrive in Stage 5." />
    <main className="w-full max-w-5xl mx-auto p-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {reservations.length === 0 && <p className="p-6 text-sm text-slate-500">No reservations yet.</p>}
        {reservations.map((reservation) => <div key={reservation.id} className="flex items-center justify-between gap-4 p-4">
          <div><p className="text-sm font-semibold text-slate-900">{reservation.title}</p><p className="text-xs text-slate-500">{reservation.resource.name} · {user.role === "ADMIN" ? `${reservation.user.name} · ` : ""}{new Intl.DateTimeFormat("en-LK", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" }).format(reservation.startTime)}</p></div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{reservation.status}</span>
        </div>)}
      </div>
    </main>
  </>;
  const categories = await getCategories();
  const rawResources = await getResources();

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
    <div className="flex-1 flex flex-col min-w-0">
      {/* Page Header matching Resources page layout */}
      <header className="px-8 pt-7 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {user.role === "ADMIN" ? "Reservation Management" : "My Reservations"}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {user.role === "ADMIN"
            ? "Manage organizational reservations, approvals, and resource schedules."
            : "Schedule, track, and manage your room and equipment bookings."}
        </p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-8 pb-12 max-w-7xl w-full">
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
            reservations={rawReservations}
            pendingReservations={rawPending}
          />
        </Suspense>
      </main>
    </div>
  );
}
