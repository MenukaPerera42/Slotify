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
  canManage?: boolean;
}

export function AvailabilityCard({ resource, categories, canManage = false }: AvailabilityCardProps) {
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
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs hover:border-slate-300 transition-all space-y-4">
        {/* Top Row: Name, Location, Attribute Pills, and Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Resource Name & Location */}
          <div className="flex items-center gap-3 min-w-52">
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
              {renderIcon()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {resource.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {resource.location}
              </p>
            </div>
          </div>

          {/* Middle: Attribute Pills matching reference screenshot light-blue badge style */}
          <div className="flex flex-wrap items-center gap-2">
            {resource.capacity !== null && (
              <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
                {resource.capacity} People
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
              {resource.category.name}
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
              Projector
            </span>
          </div>

          {/* Right: Actions and Primary Booking Button */}
          <div className="flex items-center gap-2">
            <Link href={`/resources/${resource.id}`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                <span>Details</span>
              </Button>
            </Link>

            {canManage && <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleStatus}
              disabled={isPending}
              className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
              title={resource.isActive ? "Deactivate Resource" : "Activate Resource"}
            >
              <Power
                className={`h-3.5 w-3.5 ${
                  resource.isActive ? "text-amber-600" : "text-emerald-600"
                }`}
              />
            </Button>}

            {canManage && <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              <span>Edit</span>
            </Button>}

            <Link href={`/reservations?bookResourceId=${resource.id}`}>
              <Button
                size="sm"
                className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
              >
                <span>Book meeting room</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Bottom Row: Green Status Indicator & Working Hours matching reference */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                resource.isActive
                  ? "bg-emerald-500 ring-2 ring-emerald-100"
                  : "bg-slate-300 ring-2 ring-slate-100"
              }`}
            />
            <span className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">
              {resource.isActive ? "AVAILABLE" : "INACTIVE"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <Clock className="h-3.5 w-3.5" />
            <span>7:00 AM – 4:00 PM</span>
          </div>
        </div>
      </div>

      {canManage && <ResourceFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        categories={categories}
        resource={resource}
      />}
    </>
  );
}
