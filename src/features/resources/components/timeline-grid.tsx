"use client";

import { Building2, Monitor, Cpu, Layers } from "lucide-react";
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
  // Only display the top 3 resources for the compact overview timeline
  const previewResources = resources.slice(0, 3);

  const renderIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes("meeting") || lower.includes("room")) return <Building2 className="h-4 w-4" />;
    if (lower.includes("workstation") || lower.includes("desk")) return <Monitor className="h-4 w-4" />;
    if (lower.includes("lab") || lower.includes("equipment") || lower.includes("gpu")) return <Cpu className="h-4 w-4" />;
    return <Layers className="h-4 w-4" />;
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          {/* Header Row: Room label + Time markers */}
          <div className="flex items-center border-b border-[#E5E7EB] bg-slate-50/60 text-[11px] font-semibold text-slate-500">
            <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 font-bold text-slate-700">
              Rooms & Resources
            </div>
            <div className="flex-1 grid grid-cols-10 divide-x divide-[#E5E7EB] text-center">
              {timeSlots.map((slot) => (
                <div key={slot} className="py-2.5 px-1 truncate">
                  {slot}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Rows per Resource */}
          <div className="divide-y divide-[#E5E7EB]">
            {previewResources.map((res) => (
              <div key={res.id} className="flex items-stretch group hover:bg-slate-50/40 transition-colors">
                {/* Left Column: Resource Card with Thumbnail/Icon */}
                <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    {renderIcon(res.category.name)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 truncate">
                      {res.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">
                      {res.location}
                    </p>
                    <p className="text-[10px] text-blue-600 font-medium">
                      {res.capacity ? `${res.capacity} People` : "Individual"}
                    </p>
                  </div>
                </div>

                {/* Right Columns: Empty Time Slot Cells (Ready for Stage 4 Bookings) */}
                <div className="flex-1 grid grid-cols-10 divide-x divide-[#E5E7EB] bg-white">
                  {timeSlots.map((slot, idx) => (
                    <div
                      key={slot}
                      className="h-16 relative flex items-center justify-center border-dashed hover:bg-blue-50/20 transition-colors cursor-pointer"
                      title={`${res.name} at ${slot}`}
                    >
                      {/* Subtly show an indicative booking block on first slot to match screenshot visual feel */}
                      {idx === 2 && res.isActive && (
                        <div className="absolute inset-x-1 inset-y-2 rounded-md bg-blue-100/70 border border-blue-200 flex items-center justify-center text-[10px] font-semibold text-blue-700 pointer-events-none">
                          Reserved
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
