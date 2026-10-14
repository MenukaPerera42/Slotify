"use client";

import Link from "next/link";
import {
  Building2,
  Monitor,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
} from "lucide-react";
import type { ResourceItem } from "./resource-card";

interface TimelineGridProps {
  resources: ResourceItem[];
}

const timeSlots = [
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
];

export function TimelineGrid({ resources }: TimelineGridProps) {
  // Show top 2 resources for the timeline overview matching reference screenshot
  const previewResources = resources.slice(0, 2);

  const renderIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes("meeting") || lower.includes("room"))
      return <Building2 className="h-5 w-5" />;
    if (lower.includes("workstation") || lower.includes("desk"))
      return <Monitor className="h-5 w-5" />;
    if (lower.includes("lab") || lower.includes("equipment") || lower.includes("gpu"))
      return <Cpu className="h-5 w-5" />;
    return <Layers className="h-5 w-5" />;
  };

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            {/* Header Row: Room label + Time markers + reference arrows */}
            <div className="flex items-center border-b border-[#E5E7EB] bg-slate-50/50 text-[11px] font-semibold text-slate-500">
              <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 font-bold text-slate-800 flex items-center justify-between">
                <span>Rooms</span>
                <span className="text-slate-400">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="flex-1 grid grid-cols-10 divide-x divide-[#E5E7EB] text-center">
                {timeSlots.map((slot, idx) => (
                  <div
                    key={slot}
                    className="py-2.5 px-1 truncate flex items-center justify-center relative"
                  >
                    <span>{slot}</span>
                    {idx === timeSlots.length - 1 && (
                      <span className="absolute right-1 text-slate-400">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Rows per Resource */}
            <div className="divide-y divide-[#E5E7EB]">
              {previewResources.map((res) => (
                <div
                  key={res.id}
                  className="flex items-stretch group hover:bg-slate-50/30 transition-colors"
                >
                  {/* Left Column: Resource Card with Thumbnail/Icon */}
                  <div className="w-56 p-3.5 pl-4 border-r border-[#E5E7EB] shrink-0 flex items-center gap-3">
                    <div className="h-12 w-14 rounded-lg bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      {renderIcon(res.category.name)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {res.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">
                        {res.location}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {res.capacity ? `${res.capacity} People` : "Individual"}
                      </p>
                    </div>
                  </div>

                  {/* Right Columns: Time Slot Cells */}
                  <div className="flex-1 grid grid-cols-10 divide-x divide-[#E5E7EB] bg-white">
                    {timeSlots.map((slot, idx) => (
                      <div
                      <Link
                        key={slot}
                        href={`/reservations?bookResourceId=${res.id}`}
                        className="h-14 relative flex items-center justify-center hover:bg-blue-50/20 transition-colors cursor-pointer"
                        title={`${res.name} at ${slot}`}
                        title={`Book ${res.name} at ${slot}`}
                      >
                        {/* Sample booking block matching screenshot visual feel */}
                        {idx === 2 && res.isActive && (
                          <div className="absolute inset-x-1 inset-y-2 rounded-md bg-blue-100/70 border border-blue-200 flex items-center justify-center text-[10px] font-semibold text-blue-700 pointer-events-none">
                            Reserved
                          </div>
                        )}
                      </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Double Chevron Down expander matching reference screenshot */}
      <div className="flex justify-center pt-1">
        <div className="p-1 rounded-full text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
          <ChevronsDown className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
