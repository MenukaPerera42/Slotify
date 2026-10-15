"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/authorization";
import {
  createResource,
  updateResource,
  toggleResourceStatus,
  ResourceCategoryAssignmentError,
} from "../services/resource-service";
import { resourceSchema } from "../schemas/resource-schema";

export type ActionResponse<T = unknown> = {
  success: boolean;
  code?: "INVALID_INPUT" | "NOT_FOUND" | "INACTIVE_CATEGORY" | "FORBIDDEN" | "DATABASE_ERROR";
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

function resourceError(error: unknown): ActionResponse {
  if (error instanceof ResourceCategoryAssignmentError) return { success: false, code: error.code, error: error.message };
  if (error instanceof Error && error.message === "Resource not found.") return { success: false, code: "NOT_FOUND", error: "Resource not found." };
  if (error instanceof Prisma.PrismaClientKnownRequestError) return { success: false, code: "DATABASE_ERROR", error: "Unable to complete the resource operation." };
  if (error instanceof Error && error.message === "Forbidden") return { success: false, code: "FORBIDDEN", error: "Administrator access is required." };
  return { success: false, code: "DATABASE_ERROR", error: "Unable to complete the resource operation." };
}

export async function createResourceAction(
  formData: unknown
): Promise<ActionResponse> {
  try {
    await requireAdmin();
    const validated = resourceSchema.safeParse(formData);

    if (!validated.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
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
    return resourceError(error);
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
        code: "INVALID_INPUT",
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
    return resourceError(error);
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
    return resourceError(error);
  }
}

