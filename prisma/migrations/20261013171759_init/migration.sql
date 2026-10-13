-- Enable btree_gist extension for PostgreSQL exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- Check Constraint: Ensure startTime < endTime
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_start_before_end_check" CHECK ("startTime" < "endTime");

-- Exclusion Constraint: Prevent overlapping active/CONFIRMED reservations on the same resource
-- [startTime, endTime) half-open interval ensures adjacent bookings (e.g., 09:00-10:00 and 10:00-11:00) are allowed, while overlaps are strictly rejected at the database engine level.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_overlap_confirmed_excl"
EXCLUDE USING gist (
  "resourceId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE ("status" = 'CONFIRMED');

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "resource_categories_name_key" ON "resource_categories"("name");

-- CreateIndex
CREATE INDEX "resources_categoryId_idx" ON "resources"("categoryId");

-- CreateIndex
CREATE INDEX "resources_isActive_idx" ON "resources"("isActive");

-- CreateIndex
CREATE INDEX "reservations_resourceId_startTime_endTime_idx" ON "reservations"("resourceId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "reservations_userId_idx" ON "reservations"("userId");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "resource_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
