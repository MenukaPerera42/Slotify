-- Stage nullable relations so existing users and reservations keep their IDs and history.
CREATE TABLE "departments" (
  "id" UUID NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
CREATE INDEX "departments_isActive_idx" ON "departments"("isActive");

ALTER TABLE "users" ADD COLUMN "departmentId" UUID;
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservations" ADD COLUMN "departmentId" UUID;
ALTER TABLE "reservations" ALTER COLUMN "userId" DROP NOT NULL;
CREATE INDEX "reservations_departmentId_startTime_idx" ON "reservations"("departmentId", "startTime");
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legacy rows may remain unresolved. Every *new* reservation must have an
-- active department, and an individual owner must be active in that department.
CREATE FUNCTION reservation_department_insert_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."departmentId" IS NULL THEN
    RAISE EXCEPTION 'Department required for new reservation' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM "departments" WHERE id = NEW."departmentId" AND "isActive" FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department inactive or missing' USING ERRCODE = '23514';
  END IF;
  IF NEW."userId" IS NOT NULL THEN
    PERFORM 1 FROM "users"
      WHERE id = NEW."userId" AND "isActive" AND "departmentId" = NEW."departmentId" FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Owner inactive or department mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER reservations_department_insert_guard BEFORE INSERT ON "reservations"
  FOR EACH ROW EXECUTE FUNCTION reservation_department_insert_guard();
