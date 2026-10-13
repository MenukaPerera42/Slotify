import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization";
import type { ResourceFormData, ResourceQueryParams } from "../schemas/resource-schema";

export async function getCategories() {
  return await prisma.resourceCategory.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getResources(params?: ResourceQueryParams) {
  const where: Record<string, unknown> = {};

  if (params?.search && params.search.trim().length > 0) {
    where.name = {
      contains: params.search.trim(),
      mode: "insensitive",
    };
  }

  if (params?.categoryId && params.categoryId !== "ALL") {
    where.categoryId = params.categoryId;
  }

  if (params?.status === "ACTIVE") {
    where.isActive = true;
  } else if (params?.status === "INACTIVE") {
    where.isActive = false;
  }

  return await prisma.resource.findMany({
    where,
    include: {
      category: true,
      _count: {
        select: {
          reservations: {
            where: {
              status: { in: ["PENDING", "APPROVED"] },
            },
          },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getResourceById(id: string) {
  return await prisma.resource.findUnique({
    where: { id },
    include: {
      category: true,
      _count: {
        select: {
          reservations: true,
        },
      },
    },
  });
}

export async function createResource(data: ResourceFormData) {
  await requireAdmin();
  // Verify category exists
  const category = await prisma.resourceCategory.findUnique({
    where: { id: data.categoryId },
  });

  if (!category) {
    throw new Error("Specified resource category does not exist.");
  }

  return await prisma.resource.create({
    data: {
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      location: data.location,
      capacity: data.capacity,
      isActive: data.isActive,
    },
    include: {
      category: true,
    },
  });
}

export async function updateResource(id: string, data: ResourceFormData) {
  await requireAdmin();
  // Verify resource exists
  const existing = await prisma.resource.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Resource not found.");
  }

  // Verify category exists
  const category = await prisma.resourceCategory.findUnique({
    where: { id: data.categoryId },
  });

  if (!category) {
    throw new Error("Specified resource category does not exist.");
  }

  return await prisma.resource.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      location: data.location,
      capacity: data.capacity,
      isActive: data.isActive,
    },
    include: {
      category: true,
    },
  });
}

export async function toggleResourceStatus(id: string) {
  await requireAdmin();
  const existing = await prisma.resource.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!existing) {
    throw new Error("Resource not found.");
  }

  return await prisma.resource.update({
    where: { id },
    data: {
      isActive: !existing.isActive,
    },
    include: {
      category: true,
    },
  });
}

