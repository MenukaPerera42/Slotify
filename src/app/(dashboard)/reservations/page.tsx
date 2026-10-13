import Link from "next/link";
import { CalendarDays, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReservationsPlaceholderPage() {
  return (
    <>
      <AppHeader
        title="Reservations"
        description="Booking timelines, time-slot selection, and conflict management engine."
      />

      <main className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">
        <Card className="border-dashed border-slate-300 bg-white/70 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mx-auto mb-4 border border-blue-100">
            <CalendarDays className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Reservations Module — Stage 4</CardTitle>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            The database models and PostgreSQL GiST exclusion locks for collision-free booking are in place. The reservation booking wizard and time-slot timeline will be implemented in Stage 4.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/resources">
              <Button className="flex items-center gap-2">
                <span>Explore Resource Catalog</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    </>
  );
}
