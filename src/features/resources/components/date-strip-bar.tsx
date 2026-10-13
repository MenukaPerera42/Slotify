"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const daysData = [
  { day: "Fri", date: 5, month: "Dec" },
  { day: "Mon", date: 8, month: "Dec", isSelected: true },
  { day: "Tue", date: 9, month: "Dec" },
  { day: "Wed", date: 10, month: "Dec" },
  { day: "Thu", date: 11, month: "Dec" },
  { day: "Fri", date: 12, month: "Dec" },
  { day: "Mon", date: 15, month: "Dec" },
  { day: "Tue", date: 16, month: "Dec" },
  { day: "Wed", date: 17, month: "Dec" },
  { day: "Thu", date: 18, month: "Dec" },
  { day: "Fri", date: 19, month: "Dec" },
  { day: "Mon", date: 22, month: "Dec" },
  { day: "Tue", date: 23, month: "Dec" },
];

export function DateStripBar() {
  const [selectedDate, setSelectedDate] = useState(8);

  return (
    <div className="flex items-center gap-1.5 w-full overflow-x-auto py-1 scrollbar-none select-none">
      <button
        type="button"
        className="h-8 w-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors shrink-0 shadow-2xs"
        aria-label="Previous date range"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 flex-1 justify-between min-w-0">
        {daysData.map((item) => {
          const isCurrent = item.date === selectedDate;
          return (
            <button
              key={`${item.day}-${item.date}`}
              type="button"
              onClick={() => setSelectedDate(item.date)}
              className={cn(
                "flex-1 min-w-[58px] py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all border shadow-2xs",
                isCurrent
                  ? "bg-blue-50 border-blue-200 text-blue-700 shadow-xs"
                  : "bg-white border-slate-200/80 text-slate-600 hover:border-slate-300"
              )}
            >
              <span className="text-[10px] font-medium text-slate-400 leading-none mb-1">
                {item.day}
              </span>
              <span className={cn("text-base font-bold leading-none", isCurrent ? "text-blue-700" : "text-slate-800")}>
                {item.date}
              </span>
              <span className="text-[9px] font-medium text-slate-400 leading-none mt-1">
                {item.month}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="h-8 w-8 rounded-full border border-blue-600 bg-white flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors shrink-0 shadow-2xs"
        aria-label="Next date range"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
