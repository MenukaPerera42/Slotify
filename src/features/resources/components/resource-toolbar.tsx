"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceFormModal } from "./resource-form-modal";
import { DateStripBar } from "./date-strip-bar";

interface CategoryItem {
  id: string;
  name: string;
  isActive?: boolean;
}

interface ResourceToolbarProps {
  categories: CategoryItem[];
  canManage?: boolean;
  selectedCategory?: string;
  selectedStatus?: string;
  searchQuery?: string;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  activeView?: "calendar" | "map";
  onViewChange?: (view: "calendar" | "map") => void;
}

export function ResourceToolbar({
  categories,
  canManage = false,
  selectedCategory = "ALL",
  selectedStatus = "ALL",
  searchQuery = "",
  selectedDate,
  onSelectDate,
  activeView = "calendar",
  onViewChange,
}: ResourceToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [search, setSearch] = useState(searchQuery);

  const updateFilters = (key: string, value: string) => {
    const current = new URLSearchParams(
      searchParams ? Array.from(searchParams.entries()) : []
    );

    if (!value || value === "ALL" || value === "") {
      current.delete(key);
    } else {
      current.set(key, value);
    }

    startTransition(() => {
      const query = current.toString();
      router.push(`/resources${query ? `?${query}` : ""}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters("search", search.trim());
  };

  const handleReset = () => {
    setSearch("");
    startTransition(() => {
      router.push("/resources");
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Top Segment: Tabs (Calendar / Catalog Cards) + Add Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onViewChange?.("calendar")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeView === "calendar"
                  ? "bg-blue-100/70 text-blue-700 shadow-2xs"
                  : "bg-white text-slate-500 hover:text-slate-800 border border-slate-200"
              }`}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => onViewChange?.("map")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeView === "map"
                  ? "bg-blue-100/70 text-blue-700 shadow-2xs"
                  : "bg-white text-slate-500 hover:text-slate-800 border border-slate-200"
              }`}
            >
              Catalog Cards
            </button>
          </div>

          {canManage && (
            <Button
              onClick={() => setIsAddOpen(true)}
              size="sm"
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add Resource</span>
            </Button>
          )}
        </div>

        {/* Dynamic Date Strip Bar (Exactly ONE instance wired to active date) */}
        <DateStripBar
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />

        {/* Filter inputs matching reference layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Search Input Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center min-w-0">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search resource name..."
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-16 text-xs text-slate-800 shadow-2xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
            {search && (
              <button
                type="submit"
                className="absolute right-2 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
              >
                Go
              </button>
            )}
          </form>

          {/* Category Dropdown styled as pill */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => updateFilters("categoryId", e.target.value)}
              disabled={isPending}
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-xs text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none cursor-pointer"
            >
              <option value="ALL">Filter categories (All)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
              ▼
            </div>
          </div>

          {/* Operational Status Dropdown */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedStatus}
                onChange={(e) => updateFilters("status", e.target.value)}
                disabled={isPending}
                className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-xs text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none cursor-pointer"
              >
                <option value="ALL">Operational status (All)</option>
                <option value="ACTIVE">Operational (Active)</option>
                <option value="INACTIVE">Deactivated</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>

            {(selectedCategory !== "ALL" || selectedStatus !== "ALL" || searchQuery !== "") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-10 text-xs text-slate-500 hover:text-slate-800"
                title="Reset filters"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <ResourceFormModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          categories={categories}
          isAdmin={canManage}
        />
      )}
    </>
  );
}
