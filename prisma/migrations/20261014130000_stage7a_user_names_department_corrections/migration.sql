-- Keep historical display names unchanged; no guessed first/last-name backfill.
ALTER TABLE "users" ADD COLUMN "firstName" TEXT, ADD COLUMN "lastName" TEXT;

-- Every reviewed department correction is an append-only audit event.
CREATE TABLE "reservation_department_corrections" (
  "id" UUID NOT NULL PRIMARY KEY,
  "reservationId" UUID NOT NULL,
  "previousDepartmentId" UUID,
  "newDepartmentId" UUID NOT NULL,
  "correctedByUserId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_department_corrections_reason_check" CHECK (length(trim("reason")) > 0),
  CONSTRAINT "reservation_department_corrections_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_department_corrections_previousDepartmentId_fkey" FOREIGN KEY ("previousDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_department_corrections_newDepartmentId_fkey" FOREIGN KEY ("newDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_department_corrections_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "reservation_department_corrections_reservationId_createdAt_idx" ON "reservation_department_corrections"("reservationId", "createdAt");
CREATE INDEX "reservation_department_corrections_correctedByUserId_idx" ON "reservation_department_corrections"("correctedByUserId");
