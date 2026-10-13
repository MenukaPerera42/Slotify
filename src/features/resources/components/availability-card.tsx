"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Eye,
  Pencil,
  Power,
  Building2,
  Monitor,
  Cpu,
  Layers,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceFormModal } from "./resource-form-modal";
import { toggleResourceStatusAction } from "../actions/resource-actions";
import type { ResourceItem } from "./resource-card";

interface AvailabilityCardProps {
  resource: ResourceItem;
  categories: { id: string; name: string }[];
}

export function AvailabilityCard({ resource, categories }: AvailabilityCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggleStatus = () => {
    startTransition(async () => {
      await toggleResourceStatusAction(resource.id);
    });
  };

  const renderIcon = () => {
    const lower = resource.category.name.toLowerCase();
    if (lower.includes("meeting") || lower.includes("room") || lower.includes("board")) {
      return <Building2 className="h-5 w-5" />;
    }
    if (lower.includes("workstation") || lower.includes("desk") || lower.includes("pod")) {
      return <Monitor className="h-5 w-5" />;
    }
    if (lower.includes("lab") || lower.includes("equipment") || lower.includes("server") || lower.includes("gpu")) {
      return <Cpu className="h-5 w-5" />;
    }
    return <Layers className="h-5 w-5" />;
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left Section: Details, Tags & Status */}
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
              {renderIcon()}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {resource.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {resource.location}
              </p>
            </div>
          </div>

          {/* Reference pill tag badges: e.g. "6 People", "Projector", "TV" */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {resource.capacity !== null && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-600">
                {resource.capacity} People
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-600">
              {resource.category.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-600">
              High-Speed Network
            </span>
          </div>

          {/* Availability Status line matching reference green dot */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 font-bold tracking-wider text-[11px] uppercase">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  resource.isActive ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <span className={resource.isActive ? "text-emerald-700" : "text-slate-500"}>
                {resource.isActive ? "Available" : "Deactivated"}
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              <span>7:00 AM – 8:00 PM</span>
            </div>
          </div>
        </div>

        {/* Right Section: Actions & Booking Button matching reference */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Link href={`/resources/${resource.id}`}>
              <Button variant="ghost" size="sm" className="h-9 text-xs text-slate-600 hover:text-slate-900">
                <Eye className="h-3.5 w-3.5 mr-1 text-slate-400" />
                <span>Details</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              disabled={isPending}
              className="h-9 text-xs text-slate-600"
              title={resource.isActive ? "Deactivate Resource" : "Activate Resource"}
            >
              <Power className={`h-3.5 w-3.5 ${resource.isActive ? "text-amber-600" : "text-emerald-600"}`} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="h-9 text-xs text-slate-600"
            >
              <Pencil className="h-3.5 w-3.5 mr-1 text-slate-400" />
              <span>Edit</span>
            </Button>
          </div>

          {/* Reference blue button: "Book meeting room ->" */}
          <Link href="/reservations">
            <Button
              size="default"
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs w-full sm:w-auto"
            >
              <span>Book {resource.name.split(" ")[0]}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <ResourceFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        categories={categories}
        resource={resource}
      />
    </>
  );
}
