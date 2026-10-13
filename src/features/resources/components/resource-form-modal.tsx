"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createResourceAction, updateResourceAction } from "../actions/resource-actions";

interface CategoryOption {
  id: string;
  name: string;
}

interface ResourceFormDataProp {
  id?: string;
  name: string;
  description: string | null;
  categoryId: string;
  location: string;
  capacity: number | null;
  isActive: boolean;
}

interface ResourceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  resource?: ResourceFormDataProp | null;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending
        ? isEditing
          ? "Saving Changes..."
          : "Creating Resource..."
        : isEditing
        ? "Save Changes"
        : "Create Resource"}
    </Button>
  );
}

export function ResourceFormModal({
  isOpen,
  onClose,
  categories,
  resource,
}: ResourceFormModalProps) {
  const isEditing = Boolean(resource?.id);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setFieldErrors({});

    const rawData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      categoryId: formData.get("categoryId") as string,
      location: formData.get("location") as string,
      capacity: formData.get("capacity")
        ? parseInt(formData.get("capacity") as string, 10)
        : null,
      isActive: formData.get("isActive") === "on",
    };

    let result;
    if (isEditing && resource?.id) {
      result = await updateResourceAction(resource.id, rawData);
    } else {
      result = await createResourceAction(rawData);
    }

    if (!result.success) {
      setError(result.error || "Failed to save resource.");
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Resource" : "Add New Resource"}
      description={
        isEditing
          ? "Update the details and operational status for this resource."
          : "Register a new shared asset, conference room, or workstation."
      }
    >
      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="name"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Resource Name <span className="text-rose-500">*</span>
          </label>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Grand Horizon Boardroom (A-101)"
            defaultValue={resource?.name || ""}
            required
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-rose-600 font-medium">
              {fieldErrors.name[0]}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="categoryId"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={resource?.categoryId || categories[0]?.id || ""}
              required
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-transparent text-slate-900"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {fieldErrors.categoryId[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="location"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Location <span className="text-rose-500">*</span>
            </label>
            <Input
              id="location"
              name="location"
              placeholder="e.g. Building A, Floor 2"
              defaultValue={resource?.location || ""}
              required
            />
            {fieldErrors.location && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {fieldErrors.location[0]}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="capacity"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Capacity (Optional)
            </label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min="1"
              max="500"
              placeholder="e.g. 12"
              defaultValue={resource?.capacity !== null && resource?.capacity !== undefined ? resource.capacity : ""}
            />
            {fieldErrors.capacity && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {fieldErrors.capacity[0]}
              </p>
            )}
          </div>

          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={resource ? resource.isActive : true}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-800">
                Resource is Active & Available
              </span>
            </label>
          </div>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Description (Optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Key equipment details, display connections, or access guidelines..."
            defaultValue={resource?.description || ""}
            className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-transparent resize-none text-slate-900"
          />
          {fieldErrors.description && (
            <p className="mt-1 text-xs text-rose-600 font-medium">
              {fieldErrors.description[0]}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <SubmitButton isEditing={isEditing} />
        </div>
      </form>
    </Modal>
  );
}

