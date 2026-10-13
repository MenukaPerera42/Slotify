import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Users,
  CalendarDays,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { getResourceById } from "@/features/resources/services/resource-service";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ResourceDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ResourceDetailPage({
  params,
}: ResourceDetailPageProps) {
  const { id } = await params;
  const resource = await getResourceById(id);

  if (!resource) {
    notFound();
  }

  return (
    <>
      <AppHeader
        title={resource.name}
        description={`Resource detail and specifications under ${resource.category.name}.`}
        action={
          <Link href="/resources">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Catalog</span>
            </Button>
          </Link>
        }
      />

      <main className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Resource Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  {resource.category.name}
                </span>
                <Badge variant={resource.isActive ? "success" : "inactive"}>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      resource.isActive ? "bg-emerald-600" : "bg-slate-400"
                    }`}
                  />
                  {resource.isActive ? "Operational" : "Deactivated"}
                </Badge>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {resource.name}
              </h2>
              <p className="text-sm text-slate-500 max-w-xl">
                {resource.description || "No specific configuration instructions provided."}
              </p>
            </div>
          </div>
        </div>

        {/* Specifications & Location Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span>Physical Location</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-slate-900">
                {resource.location}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Designated office, lab annex, or server room position.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <Users className="h-4 w-4 text-emerald-600" />
                <span>Capacity</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-slate-900">
                {resource.capacity !== null ? `${resource.capacity} Seats / Users` : "N/A (Individual / Node)"}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Recommended maximum concurrent attendees or operators.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
                <span>Historical Bookings</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-slate-900">
                {resource._count?.reservations || 0} Total Records
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Preserved audit trail and historical reservation records.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Informational Guidance Box */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5 text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-900">
                Soft Deactivation & Integrity Safeguards
              </h4>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Resources are never permanently hard-deleted to preserve complete reservation history. When a resource is deactivated, all historical records remain securely intact in the database while new bookings are prevented.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
