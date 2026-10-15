import "server-only";
import { Prisma } from "@prisma/client";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import type { z } from "zod";
import type { categoryListSchema, createCategorySchema, updateCategorySchema } from "../schemas/category-schema";

export type CategoryCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "NOT_FOUND" | "IN_USE" | "DUPLICATE_NAME" | "DATABASE_ERROR";
export class CategoryError extends Error {
  constructor(public readonly code: CategoryCode, message: string) { super(message); }
}
async function admin() {
  const user = await currentUser();
  if (!user) throw new CategoryError("UNAUTHENTICATED", "Sign in with an active account to continue.");
  if (user.role !== "ADMIN") throw new CategoryError("FORBIDDEN", "Administrator access is required.");
}
async function checkName(name: string | undefined, excludeId?: string) {
  if (name && await prisma.resourceCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) {
    throw new CategoryError("DUPLICATE_NAME", "A category with this name already exists.");
  }
}
export async function listCategories(input: z.output<typeof categoryListSchema>) {
  await admin();
  const where: Prisma.ResourceCategoryWhereInput = {
    ...(input.status === "ACTIVE" ? { isActive: true } : input.status === "INACTIVE" ? { isActive: false } : {}),
    ...(input.search ? { name: { contains: input.search, mode: "insensitive" } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.resourceCategory.findMany({ where, include: { _count: { select: { resources: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.resourceCategory.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}
export async function createCategory(input: z.output<typeof createCategorySchema>) {
  await admin();
  await checkName(input.name);
  return prisma.resourceCategory.create({ data: input });
}
export async function updateCategory(id: string, input: z.output<typeof updateCategorySchema>) {
  await admin();
  if (!await prisma.resourceCategory.findUnique({ where: { id }, select: { id: true } })) throw new CategoryError("NOT_FOUND", "Category not found.");
  await checkName(input.name, id);
  return prisma.resourceCategory.update({ where: { id }, data: input });
}
export async function setCategoryStatus(id: string, isActive: boolean) {
  await admin();
  const result = await prisma.resourceCategory.updateMany({ where: { id }, data: { isActive } });
  if (!result.count) throw new CategoryError("NOT_FOUND", "Category not found.");
  return prisma.resourceCategory.findUniqueOrThrow({ where: { id } });
}
export async function deleteCategory(id: string) {
  await admin();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM resource_categories WHERE id = ${id}::uuid FOR UPDATE`;
    if (!rows[0]) throw new CategoryError("NOT_FOUND", "Category not found.");
    if (await tx.resource.count({ where: { categoryId: id } })) throw new CategoryError("IN_USE", "Category has linked resources.");
    return tx.resourceCategory.delete({ where: { id } });
  });
}
