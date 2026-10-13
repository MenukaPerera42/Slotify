-- Preserve existing bookings while introducing the approval statuses.
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT, ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "reservations" DROP CONSTRAINT "reservations_no_overlap_confirmed_excl";
ALTER TABLE "reservations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "ReservationStatus" RENAME TO "ReservationStatus_old";
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "reservations" ALTER COLUMN "status" TYPE "ReservationStatus"
  USING (CASE WHEN "status"::text = 'CONFIRMED' THEN 'APPROVED' ELSE "status"::text END)::"ReservationStatus";
ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "ReservationStatus_old";

-- Prisma previously wrote UTC instants to timestamp-without-zone columns.
-- Interpret those existing wall-clock values as UTC during conversion.
ALTER TABLE "reservations"
  ALTER COLUMN "startTime" TYPE TIMESTAMPTZ(3) USING "startTime" AT TIME ZONE 'UTC',
  ALTER COLUMN "endTime" TYPE TIMESTAMPTZ(3) USING "endTime" AT TIME ZONE 'UTC';

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_overlap_blocking_excl"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startTime", "endTime", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'APPROVED'));

ALTER TABLE "reservations" DROP CONSTRAINT "reservations_resourceId_fkey";
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_userId_fkey";
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "reservations_userId_startTime_idx" ON "reservations"("userId", "startTime");

CREATE FUNCTION reservation_status_transition_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'PENDING' AND NEW."status" IN ('APPROVED', 'REJECTED', 'CANCELLED')) OR
    (OLD."status" = 'APPROVED' AND NEW."status" = 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'Invalid reservation status transition: % to %', OLD."status", NEW."status"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER reservations_status_transition_guard BEFORE UPDATE OF "status" ON "reservations"
  FOR EACH ROW EXECUTE FUNCTION reservation_status_transition_guard();

CREATE FUNCTION last_active_admin_guard() RETURNS trigger AS $$
BEGIN
  IF OLD."role" = 'ADMIN' AND OLD."isActive" AND
     (TG_OP = 'DELETE' OR NEW."role" <> 'ADMIN' OR NOT NEW."isActive") THEN
    PERFORM pg_advisory_xact_lock(618312, 4);
    IF (SELECT count(*) FROM "users" WHERE "role" = 'ADMIN' AND "isActive") <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last active admin' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER users_last_admin_guard BEFORE UPDATE OF "role", "isActive" OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION last_active_admin_guard();
