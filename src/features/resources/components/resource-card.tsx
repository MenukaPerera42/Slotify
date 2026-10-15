"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  MapPin,
  Users,
  Eye,
  Pencil,
  Power,
  Building2,
  Monitor,
  Cpu,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResourceFormModal } from "./resource-form-modal";
import { toggleResourceStatusAction } from "../actions/resource-actions";

export interface ResourceItem {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  location: string;
  capacity: number | null;
  isActive: boolean;
  category: {
    id: string;
    name: string;
  };
  _count?: {
    reservations: number;
  };
}

interface ResourceCardProps {
  resource: ResourceItem;
  categories: { id: string; name: string; isActive?: boolean }[];
}

export function ResourceCard({ resource, categories }: ResourceCardProps) {
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
      <Card className="flex flex-col justify-between hover:shadow-md transition-shadow group">
        <div>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                  {renderIcon()}
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                    {resource.category.name}
                  </span>
                  <CardTitle className="text-base text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {resource.name}
                  </CardTitle>
                </div>
              </div>
              <Badge variant={resource.isActive ? "success" : "inactive"}>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    resource.isActive ? "bg-emerald-600" : "bg-slate-400"
                  }`}
                />
                {resource.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pb-3">
            <p className="text-xs text-slate-500 line-clamp-2 min-h-8">
              {resource.description || "No specific configuration instructions provided."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate max-w-[140px]">{resource.location}</span>
              </div>
              {resource.capacity !== null && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{resource.capacity} Seats</span>
                </div>
              )}
            </div>
          </CardContent>
        </div>

        <CardFooter className="pt-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl flex items-center justify-between gap-2">
          <Link
            href={`/resources/${resource.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View Details</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              disabled={isPending}
              className="h-7 text-xs px-2 text-slate-600"
              title={resource.isActive ? "Deactivate Resource" : "Activate Resource"}
            >
              <Power className={`h-3 w-3 ${resource.isActive ? "text-amber-600" : "text-emerald-600"}`} />
              <span className="hidden sm:inline">
                {resource.isActive ? "Deactivate" : "Activate"}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="h-7 text-xs px-2 text-slate-600"
            >
              <Pencil className="h-3 w-3" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </div>
        </CardFooter>
      </Card>

      <ResourceFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        categories={categories}
        resource={resource}
        isAdmin={true}
      />
    </>
  );
}
