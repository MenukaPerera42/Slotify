"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Filter, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResourceFormModal } from "./resource-form-modal";

interface CategoryItem {
  id: string;
  name: string;
}

interface ResourceToolbarProps {
  categories: CategoryItem[];
  selectedCategory?: string;
  selectedStatus?: string;
  searchQuery?: string;
}

export function ResourceToolbar({
  categories,
  selectedCategory = "ALL",
  selectedStatus = "ALL",
  searchQuery = "",
}: ResourceToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [search, setSearch] = useState(searchQuery);

  const updateFilters = (key: string, value: string) => {
    const current = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);

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
    updateFilters("search", search);
  };

  const handleReset = () => {
    setSearch("");
    startTransition(() => {
      router.push("/resources");
    });
  };

  return (
    <>
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex-1 max-w-md flex items-center"
          >
            <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search resources by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-20 h-9"
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="absolute right-1 h-7 text-xs text-blue-600 font-semibold"
            >
              Search
            </Button>
          </form>

          {/* Add Resource Trigger */}
          <Button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Resource</span>
          </Button>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => updateFilters("categoryId", e.target.value)}
            disabled={isPending}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => updateFilters("status", e.target.value)}
            disabled={isPending}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {(selectedCategory !== "ALL" ||
            selectedStatus !== "ALL" ||
            searchQuery !== "") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      <ResourceFormModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        categories={categories}
      />
    </>
  );
}

