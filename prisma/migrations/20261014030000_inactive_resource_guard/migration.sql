CREATE FUNCTION active_resource_reservation_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."status" IN ('PENDING', 'APPROVED')
     AND NOT (SELECT "isActive" FROM "resources" WHERE id = NEW."resourceId") THEN
    RAISE EXCEPTION 'Inactive resources cannot receive blocking reservations'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_active_resource_guard
  BEFORE INSERT OR UPDATE OF "resourceId", "status" ON "reservations"
  FOR EACH ROW EXECUTE FUNCTION active_resource_reservation_guard();
