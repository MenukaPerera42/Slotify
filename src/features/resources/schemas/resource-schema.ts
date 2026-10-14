import { z } from "zod";

export const resourceSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  categoryId: z.string().uuid("Please select a valid category"),
  location: z
    .string()
    .min(2, "Location must be at least 2 characters")
    .max(100, "Location cannot exceed 100 characters")
    .trim(),
  capacity: z
    .union([z.number().int().positive("Capacity must be positive"), z.nan()])
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" && !isNaN(val) ? val : null)),
  isActive: z.boolean().default(true),
});

export type ResourceFormData = z.infer<typeof resourceSchema>;

export const resourceQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional().or(z.literal("ALL")),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).optional().default("ALL"),
});

export type ResourceQueryParams = z.infer<typeof resourceQuerySchema>;

