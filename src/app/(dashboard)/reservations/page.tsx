import { AppHeader } from "@/components/layout/app-header";
import { requireUser } from "@/lib/authorization";
import { listReservations } from "@/features/reservations/services/reservation-service";

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
}
