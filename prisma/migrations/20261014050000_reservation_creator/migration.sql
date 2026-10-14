-- Keep legacy reservations intact; their creator cannot be inferred reliably.
ALTER TABLE "reservations" ADD COLUMN "createdByUserId" UUID;
CREATE INDEX "reservations_createdByUserId_idx" ON "reservations"("createdByUserId");
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
