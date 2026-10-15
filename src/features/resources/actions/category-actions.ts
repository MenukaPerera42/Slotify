"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categoryIdSchema, categoryListSchema, createCategorySchema, setCategoryStatusSchema, updateCategorySchema } from "../schemas/category-schema";
import { CategoryError, type CategoryCode, createCategory, deleteCategory, listCategories, setCategoryStatus, updateCategory } from "../services/category-service";

type CategoryResult<T> = { success: true; data: T } | { success: false; code: CategoryCode; error: string; fieldErrors?: Record<string, string[]> };
async function run<T>(work: () => Promise<T>): Promise<CategoryResult<T>> {
  try { return { success: true, data: await work() }; }
  catch (error) {
    if (error instanceof z.ZodError) {
      const flattened = error.flatten();
      return { success: false, code: "INVALID_INPUT", error: error.issues[0]?.message ?? "Check the submitted fields.",
        fieldErrors: { ...flattened.fieldErrors, ...(flattened.formErrors.length ? { _form: flattened.formErrors } : {}) } as Record<string, string[]> };
    }
    if (error instanceof CategoryError) return { success: false, code: error.code, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { success: false, code: "DUPLICATE_NAME", error: "A category with this name already exists." };
      if (error.code === "P2003") return { success: false, code: "IN_USE", error: "Category has linked resources." };
      if (error.code === "P2025") return { success: false, code: "NOT_FOUND", error: "Category not found." };
    }
    console.error("Category operation failed:", error);
    return { success: false, code: "DATABASE_ERROR", error: "Unable to complete the category operation." };
  }
}
function refresh() {
  for (const path of ["/administration", "/resources", "/reservations", "/dashboard"]) revalidatePath(path);
}
export async function listCategoriesAction(input: unknown = {}) {
  return run(() => listCategories(categoryListSchema.parse(input)));
}
export async function createCategoryAction(input: unknown) {
  return run(async () => { const item = await createCategory(createCategorySchema.parse(input)); refresh(); return item; });
}
export async function updateCategoryAction(id: unknown, input: unknown) {
  return run(async () => { const item = await updateCategory(categoryIdSchema.parse(id), updateCategorySchema.parse(input)); refresh(); return item; });
}
export async function setCategoryStatusAction(input: unknown) {
  return run(async () => { const parsed = setCategoryStatusSchema.parse(input); const item = await setCategoryStatus(parsed.id, parsed.isActive); refresh(); return item; });
}
export async function deleteCategoryAction(id: unknown) {
  return run(async () => { const item = await deleteCategory(categoryIdSchema.parse(id)); refresh(); return item; });
}
