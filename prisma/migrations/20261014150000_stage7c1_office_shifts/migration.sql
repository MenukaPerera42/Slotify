CREATE TYPE "OfficeShiftMode" AS ENUM ('MORNING', 'EVENING', 'NIGHT', 'FULL_DAY', 'CUSTOM');

CREATE TABLE "office_shifts" (
  "id" UUID NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "mode" "OfficeShiftMode" NOT NULL,
  "description" TEXT,
  "startMinute" INTEGER NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "office_shifts_start_minute_check" CHECK ("startMinute" BETWEEN 0 AND 1439),
  CONSTRAINT "office_shifts_duration_check" CHECK ("durationMinutes" BETWEEN 1 AND 1440),
  CONSTRAINT "office_shifts_full_day_check" CHECK ("mode" <> 'FULL_DAY' OR "durationMinutes" = 1440),
  CONSTRAINT "office_shifts_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "office_shifts_name_key" ON "office_shifts"("name");
CREATE INDEX "office_shifts_isActive_idx" ON "office_shifts"("isActive");
CREATE UNIQUE INDEX "office_shifts_single_active_key" ON "office_shifts"("isActive") WHERE "isActive" = true;
