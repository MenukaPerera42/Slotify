# Slotify database architecture

Slotify uses PostgreSQL through Prisma 6. The final schema has **11 application tables**, **18 foreign keys**, and **five PostgreSQL enum types**. The [complete ERD](slotify-erd.svg), [overview](slotify-erd-overview.svg), and editable [DBML](slotify-erd.dbml) use physical PostgreSQL table and column names from `prisma/schema.prisma` (`@@map` where applicable). The 13 SQL migrations add constraints that Prisma's model alone cannot express.

## Entities and relationships

| Table | Purpose and main links |
| --- | --- |
| `users` | Authenticated ADMIN or MEMBER; optional `departmentId` → `departments`. `email` is unique. |
| `departments` | Named organizational units; `name` and `code` are unique. |
| `resource_categories` | Categories for reservable assets; unique `name`. |
| `resources` | Reservable rooms or equipment; required `categoryId` → `resource_categories`. |
| `reservations` | A timed booking for one required `resourceId` → `resources`; optional `userId` (owner) → `users`, `createdByUserId` (creator) → `users`, and `departmentId` → `departments`. |
| `notifications` | Required recipient → `users`; optional actor → `users` and optional booking → `reservations`. |
| `office_shifts` | Scheduling policy with optional `updatedByUserId` → `users`. There is **no** booking-to-shift foreign key. |
| `reservation_department_corrections` | Department correction audit: required booking, new department, and correcting user; previous department is optional. |
| `reservation_time_changes` | Time-edit audit: required booking and changing user; stores old and new intervals. |
| `email_verification_challenges` | Required subject user and optional initiating user. |
| `auth_rate_limits` | Independent rate-limit record keyed by string; no foreign keys. |

All 18 physical relationships are one-to-many from the referenced row to referencing rows. No one-to-one or many-to-many relation is defined. A nullable foreign key means its child row can exist without the referenced parent. Parent rows can have zero child rows. The DBML records these cardinalities and the actual `ON DELETE` actions. Most business links use `RESTRICT`; notification recipients and challenge subjects use `CASCADE`, while notification actors, notification reservations, shift updaters, and challenge initiators use `SET NULL`.

### Booking ownership and departments

`reservations.userId` identifies the individual owner when present; group or legacy reservations can have no owner. `createdByUserId` independently records who created the booking and is also nullable for historical compatibility. `departmentId` stores the booking's allocation, separate from the owner's current department. Historical rows may have a null department, but a database insert trigger requires an active department for every new reservation and, when an owner is set, requires that owner to be active in the same department. Department corrections retain the previous/new department IDs, actor, reason, and timestamp without replacing the booking ID.

### Categories, shifts, and lifecycle

Each resource has exactly one category. A category can contain any number of resources. `office_shifts` stores a start minute, duration, mode, and active flag; a partial unique index allows only one active shift. Checks enforce a start minute of 0–1439, a duration of 1–1440 minutes, and 1440 minutes for `FULL_DAY`. Overnight scheduling is represented by a start minute plus duration, not by an end-minute column. Reservations do not reference a specific shift row; application validation applies the configured policy.

`ReservationStatus` values are `PENDING`, `APPROVED`, `REJECTED`, and `CANCELLED`. A trigger permits `PENDING` → `APPROVED`/`REJECTED`/`CANCELLED` and `APPROVED` → `CANCELLED`; other status changes are rejected. `UserRole` is `ADMIN` or `MEMBER`. Other enums are `NotificationType` (`RESERVATION_REQUESTED`, `RESERVATION_APPROVED`, `RESERVATION_REJECTED`, `RESERVATION_CANCELLED`), `OfficeShiftMode` (`MORNING`, `EVENING`, `NIGHT`, `FULL_DAY`, `CUSTOM`), and `EmailChallengePurpose` (`REGISTRATION`, `EMAIL_CHANGE`).

## PostgreSQL integrity and concurrency

- `reservations_start_before_end_check` enforces `startTime < endTime`.
- The `btree_gist` extension supports `reservations_no_overlap_blocking_excl`. This GiST exclusion constraint compares equal `resourceId` values and overlapping `tstzrange(startTime, endTime, '[)')` ranges, only for `PENDING` and `APPROVED` rows. Adjacent bookings are valid because the interval is half-open. `REJECTED` and `CANCELLED` rows stay in history without blocking availability. This is independent of department and prevents races between concurrent writers.
- An insert trigger rejects reservations with no active department, an inactive or mismatched owner, or an inactive resource. A status trigger enforces the transitions above. A user trigger prevents removal of the last active administrator.
- Migration-only checks require a nonblank department-correction reason, valid old/new time-audit intervals, bounded challenge attempts, and nonnegative challenge resends.
- Migration-only unique indexes protect `lower(users.email)`, `lower(departments.name)`, `lower(departments.code)`, and `lower(resource_categories.name)`. Partial unique indexes restrict unconsumed email challenges and enforce one active shift. These are recorded as DBML notes because ordinary ERD relationships cannot represent their SQL predicates.
- Indexed access paths include reservation resource/time, owner/time, department/time, creator, and status; notification recipient/read/time; audit booking/time and actor; and rate-limit reset time. The DBML includes schema-declared indexes. SQL-only expression and partial indexes are described above.

Prisma `@updatedAt` timestamps are managed on ORM updates; the `resource_categories.updatedAt` column also has a database default for raw inserts. The diagram shows database types and nullability, not a claim that every Prisma default is a PostgreSQL column default.

## Sharing and scope

For a submission, use the local SVG or PNG and the [DBML source](slotify-erd.dbml). The README contains a stateless dbdiagram.io link derived from the DBML, plus instructions for importing it into an account if an editable saved diagram is required. The link contains schema text, no records or credentials. Diagram arrows summarize foreign keys; SQL checks, triggers, partial indexes, and exclusion rules are described here and in DBML notes.
