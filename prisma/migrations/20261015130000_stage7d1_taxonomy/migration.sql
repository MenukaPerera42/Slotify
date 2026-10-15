-- Keep existing IDs and links. Existing categories remain active.
ALTER TABLE "resource_categories" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "resource_categories" ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve the original unique constraints and also reject case variants.
CREATE UNIQUE INDEX "departments_name_ci_key" ON "departments" (lower("name"));
CREATE UNIQUE INDEX "departments_code_ci_key" ON "departments" (lower("code"));
CREATE UNIQUE INDEX "resource_categories_name_ci_key" ON "resource_categories" (lower("name"));
