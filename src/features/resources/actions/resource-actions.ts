"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization";
import {
  createResource,
  updateResource,
  toggleResourceStatus,
} from "../services/resource-service";
import { resourceSchema } from "../schemas/resource-schema";

export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createResourceAction(
  formData: unknown
): Promise<ActionResponse> {
  try {
    await requireAdmin();
    const validated = resourceSchema.safeParse(formData);

    if (!validated.success) {
      return {
        success: false,
        error: "Validation failed. Please check the form errors.",
        fieldErrors: validated.error.flatten().fieldErrors,
      };
    }

    const created = await createResource(validated.data);
    revalidatePath("/resources");
    revalidatePath(`/resources/${created.id}`);

    return {
      success: true,
      data: created,
    };
  } catch (error) {
    console.error("Failed to create resource:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating the resource.",
    };
  }
}

export async function updateResourceAction(
  id: string,
  formData: unknown
): Promise<ActionResponse> {
  try {
    await requireAdmin();
    if (!id) {
      return { success: false, error: "Resource ID is required." };
    }

    const validated = resourceSchema.safeParse(formData);

    if (!validated.success) {
      return {
        success: false,
        error: "Validation failed. Please check the form errors.",
        fieldErrors: validated.error.flatten().fieldErrors,
      };
    }

    const updated = await updateResource(id, validated.data);
    revalidatePath("/resources");
    revalidatePath(`/resources/${id}`);

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error("Failed to update resource:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while updating the resource.",
    };
  }
}

export async function toggleResourceStatusAction(
  id: string
): Promise<ActionResponse> {
  try {
    await requireAdmin();
    if (!id) {
      return { success: false, error: "Resource ID is required." };
    }

    const updated = await toggleResourceStatus(id);
    revalidatePath("/resources");
    revalidatePath(`/resources/${id}`);

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error("Failed to toggle resource status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while toggling resource status.",
    };
  }
}

