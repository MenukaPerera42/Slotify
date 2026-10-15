CREATE TABLE "reservation_time_changes" (
  "id" UUID NOT NULL PRIMARY KEY,
  "reservationId" UUID NOT NULL,
  "changedByUserId" UUID NOT NULL,
  "previousStartTime" TIMESTAMPTZ(3) NOT NULL,
  "previousEndTime" TIMESTAMPTZ(3) NOT NULL,
  "newStartTime" TIMESTAMPTZ(3) NOT NULL,
  "newEndTime" TIMESTAMPTZ(3) NOT NULL,
  "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_time_changes_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_time_changes_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_time_changes_interval_check" CHECK ("previousStartTime" < "previousEndTime" AND "newStartTime" < "newEndTime")
);
CREATE INDEX "reservation_time_changes_reservationId_changedAt_idx" ON "reservation_time_changes"("reservationId", "changedAt");
CREATE INDEX "reservation_time_changes_changedByUserId_idx" ON "reservation_time_changes"("changedByUserId");
