# Slotify production readiness audit — Stage 8A and 8A.1

**Date:** 2026-10-15  
**Current decision: PREVIEW DEPLOYED; NOT READY FOR PRODUCTION DEPLOYMENT.** Stage 8B cloud verification is recorded below. The Stage 8A.1 and Stage 8A sections remain as historical findings.

## Stage 8B — Neon staging and Vercel Preview, 2026-10-15

### Deployment and database identity

- Neon organization: Menuka. New isolated project `slotify-staging` (`restless-sea-15782818`), database `slotify_staging`, owner `slotify_staging_owner`, PostgreSQL 16, Singapore region. The empty database identity was verified before migration. The local application database was never targeted.
- Applied the existing 13 migrations with `prisma migrate deploy` through the **direct** Neon endpoint; exit 0. `prisma migrate status` on the direct endpoint subsequently returned exit 0 and “Database schema is up to date.” The catalog contains `btree_gist`, the reservation GiST exclusion constraint, and four application triggers.
- Prisma Client 6.4.1 uses the native PostgreSQL connector. Preview `DATABASE_URL` uses Neon’s **pooled** endpoint with `pgbouncer=true`, `connection_limit=5`, `pool_timeout=20`, and `connect_timeout=15`. Migration operations use a separate direct URL held only in an ignored local file. No Prisma adapter or Prisma 7 configuration was introduced.
- Staging fixtures were created with `prisma/seed-staging.ts`: two randomly named accounts with privately generated passwords, one department, category, room, and shift. The seed verifies the Neon host, database, and role before writing and is repeatable; the rerun exited 0 without changing accounts. Credentials remain in ignored, mode-0600 `.env.staging.local`. No personal or local demo records were copied.
- Vercel project: `slotify-staging` (`prj_DPyHjXoFlSTBMJ5haclmLSIEmHv9`). Current protected Preview: https://slotify-staging-r6mdiq83o-menukas-projects-0d8487fe.vercel.app . Preview has sensitive `DATABASE_URL` and `AUTH_SECRET`, plus `AUTH_TRUST_HOST=true`. Production environment has no configured variables. `AUTH_URL` is omitted so Auth.js can use the request host for unique Preview URLs. `.vercelignore` excludes all local environment files and build artifacts.

### Actual cloud checks

| Check | Result | Evidence |
| --- | --- | --- |
| Preview build and Prisma Client generation | PASS | Vercel build completed with Next.js 16.4.0 and Prisma 6.4.1 |
| Public homepage, login, signup, Auth.js CSRF | PASS | HTTP 200 through current protected Preview using `vercel curl` |
| Test-only reservation route | PASS | HTTP 404 on Preview |
| ADMIN login and dashboard, resources, reservations, notifications, administration | PASS | Login HTTP 302; each authenticated page HTTP 200 |
| MEMBER login and dashboard, resources, reservations, notifications | PASS | Login HTTP 302; each authenticated page HTTP 200 |
| MEMBER administration route | PASS | HTTP 404 |
| Neon overlap and adjacent interval | PASS | Disposable `APPROVED` records: overlap rejected by PostgreSQL, adjacent accepted; exit 0 |
| Neon time update and reload | PASS | Existing reservation ID and modified start persisted on a fresh Prisma read; exit 0 |
| Conflicting extension, then cancelled neighbor | PASS | Extension rejected while neighbor blocked; succeeded after neighbor became `CANCELLED`; exit 0 |
| Test record cleanup | PASS | Both disposable reservations removed; original records untouched |
| Direct migration status | PASS | Exit 0, all 13 migrations applied |
| Local typecheck, lint | PASS | Each exit 0 after Stage 8B changes |
| Local production build | PASS | `npm run build` exit 0 after Stage 8B changes |
| Live app write flows: request, approval, cancellation, editing, administration mutations | **NOT VERIFIED** | Authenticated route rendering and direct Neon writes do not establish these Server Action flows |
| Browser cookie attributes and pointer UI interactions | **NOT VERIFIED** | Automated Safari control was interrupted by concurrent user activity; HTTP route checks are not browser interaction tests |

The first Preview was configured with `connection_limit=1`; authenticated dashboard requests produced Prisma `P2024` pool timeouts. Preview was changed to `connection_limit=5` and redeployed. The current Preview authenticated route smoke passed, and its sampled runtime logs showed no new errors. The earlier failing Preview deployment was removed. This is a configuration fix observed on the current deployment, not proof of sustained load capacity.

**Deployment incident:** Vercel’s first deployment of the newly created project automatically targeted Production even though `--prod` was not supplied. It was protected by Vercel authentication, lacked the Preview environment, and logged `MissingSecret`. The deployment was immediately removed. Subsequent deployments used explicit `--target preview`; `vercel ls` showed only Preview deployments and the production alias returned 404. No production database variable was configured. A production deployment was not intentionally authorized or left active.

### Security and remaining gate

The Preview is Vercel-auth protected and uses distinct staging data and secrets. Development test routes are disabled. No secrets are in Git or the report. The current Preview proves build, routing, login, role-based route access, pooled database reads, migration compatibility, and database constraint behavior. It does **not** yet prove the full cloud mutation workflow, browser cookie flags, real pointer editing, sustained serverless concurrency, or all management actions. Complete those checks on the protected Preview before Production. Do not copy staging credentials to Production, and use a separate Production database and secrets.

**Stage 8B decision: Preview deployed and usable for further staging QA; NOT READY FOR PRODUCTION.** No commit, push, or production deployment was performed as an intended release action.

## Stage 8A.1 blocker resolution — 2026-10-15

| Original blocker | Root cause and resolution | Verification |
| --- | --- | --- |
| Stage 6B.1 depended on demo login and seeded dates | Replaced fixed credentials and existing bookings with a generated administrator/password, department, booked and unbooked resources, and two adjacent reservations. All records are tracked by IDs and removed in dependency order. | `test:stage6b1` exit 0 on the configured local database. Original demo accounts and bookings were not used. |
| Office-shift test stopped with a real active shift | The suite required zero active shifts and previously targeted the shared `DATABASE_URL`. It now requires a unique disposable database name and comment marker, and checks both direct Prisma and test-server database identities before mutations. A runner creates, migrates, verifies, tests, and drops only its marked database. | `test:office-shifts:isolated` exit 0. Direct `test:office-shifts` against the main database exits 1 before mutations. The real active shift was not changed. |
| Prisma diff reported five differences | The two email-challenge foreign keys and two indexes were created under explicit legacy names. Prisma inferred other names. Explicit `map` attributes now model the actual names. `resource_categories.updatedAt` has a `DEFAULT CURRENT_TIMESTAMP` from Stage 7D.1; Prisma `@updatedAt` handles ORM writes, while the database default permits raw inserts. Added `@default(now())` alongside `@updatedAt`. No SQL behavior changed. | Main and fresh migrated database diffs both exit 0, “No difference detected.” No migration was created or historical migration changed. |

### Disposable database method

Run `npm run build` then `npm run test:office-shifts:isolated` on the local PostgreSQL host. The runner accepts only a loopback PostgreSQL source URL, creates a random `slotify_stage8a1_*` database, writes a random database comment, and verifies that the test server and Prisma client both use that database. It applies all migrations, compares the resulting schema to the Prisma model, checks `btree_gist`, the booking exclusion constraint, foreign keys, indexes, and four application triggers, and seeds standard departments and a disposable anchor admin. The anchor satisfies the database's last-active-admin protection during test cleanup. In `finally`, it drops only a database whose name and comment still match its generated values. If identity cannot be proven, it aborts. Never run shift mutations directly against the main database. For the two signup suites, use `SLOTIFY_ISOLATED_SUITES=stage7c4a` or `SLOTIFY_ISOLATED_SUITES=admin-taxonomy` before the runner command. These use separate fresh databases to avoid shared signup-rate-limit state. The original PostgreSQL database was never reset.

### Schema and database findings

The 13 historical migrations apply cleanly to a fresh disposable database; `prisma migrate status` exits 0 there and on the main database. The fresh catalog contains `btree_gist`, the `reservations_no_overlap_blocking_excl` GiST constraint, 18 foreign keys, 47 indexes, and four application triggers. The suite exercised half-open adjacency, cross-department concurrent conflict rejection, overnight/24-hour windows, rejection leaving history without blocking, and rejection of an invalid reverse status transition. Prisma Client worked against this fresh migration history. The four naming differences were category **A (naming only)**. The `updatedAt` default was category **B (functionally meaningful raw-insert fallback, consistent with ORM-managed updates)**. No category C migration defect was found. Custom exclusion constraints and triggers were checked separately because Prisma's schema diff does not represent them. No generated diff SQL was executed.

### Actual Stage 8A.1 results

| Check | Exit | Target / result |
| --- | ---: | --- |
| `npx prisma validate` | 0 | Valid schema |
| `npx prisma migrate status` | 0 | Main local DB: 13 applied, none pending |
| `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | 0 | Main local DB: no difference |
| `npm run typecheck` | 0 | Final source |
| `npm run lint` | 0 | Final source |
| `npm run build` | 0 | Final source; Prisma Client generated |
| `npm run test:auth` | 0 | Configured local DB |
| `npm run test:reservations` | 0 | Configured local DB with active shift |
| `npm run test:notifications` | 0 | Configured local DB |
| `npm run test:departments` | 0 | Configured local DB |
| `npm run test:reservation-time-edit` | 0 | Configured local DB |
| `npm run test:timeline-range` | 0 | Pure calculation suite |
| `npm run test:timeline-interactions` | 0 | Pure interaction suite |
| `npm run test:stage6b` | 0 | Configured local DB |
| `npm run test:dashboard` | 0 | Configured local DB |
| `npm run test:admin-management` | 0 | Configured local DB |
| `npm run test:stage6b1` | 0 | Isolated records on configured local DB |
| `SLOTIFY_ISOLATED_SUITES=stage6b1 npm run test:office-shifts:isolated` | 0 | Same fixture suite on a fresh migrated disposable DB; removed afterward |
| `npm run test:office-shifts:isolated` | 0 | Newly migrated, marked disposable DB; removed afterward |
| `SLOTIFY_ISOLATED_SUITES=stage7c4a npm run test:office-shifts:isolated` | 0 | Separate fresh disposable DB; removed afterward |
| `SLOTIFY_ISOLATED_SUITES=admin-taxonomy npm run test:office-shifts:isolated` | 0 | Separate fresh disposable DB; removed afterward |

`test:stage7c4a` and `test:admin-taxonomy` first exited 1 when run sequentially on the shared main database after the auth suite: the signup action returned `RATE_LIMITED` before intended validation assertions. Their fresh-database reruns passed. An exploratory `test:reservations` on a fresh database exited 1 because that legacy suite assumes an active shift; its configured-database run passed. The disposable office suite separately verified status transitions and booking concurrency. These failed exploratory runs are not counted as passes.

### Production configuration and remaining gate

`package.json` runs `prisma generate` before the Next.js production build and provides `db:deploy` for controlled migrations. The application uses `DATABASE_URL` for Prisma and requires `AUTH_SECRET`; `AUTH_URL` is deployment-dependent. The test route is disabled unless the local test flag is set on a loopback host and remains disabled on Vercel. The new read-only database identity endpoint has the same guard. Do not set `SLOTIFY_RESERVATION_TEST_MODE` or demo credentials in Vercel. `.env` and build artifacts remain ignored. No production secret was generated or printed. The single `DATABASE_URL` design still requires a deliberate direct connection for migrations and a serverless-compatible pooled connection for Vercel runtime. This exact Neon/Vercel combination, HTTPS cookie behavior, and preview smoke tests are unverified.

**Stage 8A.1 decision: READY FOR NEON STAGING.** Provision a separate Neon branch or database, confirm extension privileges, apply migrations with a direct connection, inspect constraints/triggers and schema diff, configure pooled runtime access and authentication variables, then run a Vercel preview smoke and concurrency check. This is not approval for production deployment. No deploy, commit, or push occurred.

## Stage 8A baseline (historical findings)

## Feature completion matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Login, sign up, session revocation, rate limits | Pass locally | `test:auth`, `test:stage7c4a`; Auth.js and signup actions reviewed |
| ADMIN/MEMBER authorization and user management | Pass locally | `test:auth`, `test:admin-management`; separate MEMBER browser session |
| Departments, corrections, categories, resources | Pass locally | `test:departments`, `test:admin-taxonomy`, `test:admin-management` |
| Requests, approvals, rejection, cancellation/removal | Pass locally | `test:reservations`, `test:notifications`, `test:reservation-time-edit` |
| Move and start/end resize, same ID, audit, persistence | Pass locally | `test:reservation-time-edit`, `test:timeline-interactions`; server action/service review |
| Timeline refresh and department color | Pass locally | Stage 7D.7 isolated browser correction; `test:timeline-interactions` |
| Office shifts, overnight and 24-hour calculations | Partial | `test:timeline-range` and time-edit suite pass; full shift suite requires a database with no active shift |
| Notification ownership, read state, unread count | Pass locally | `test:notifications`, `test:stage7c4a`; Stage 7D.7 isolated browser View check |
| Dashboard schedule and analytics | Pass locally | `test:dashboard`; Stage 7D.7 browser date and correction checks |
| Booking concurrency and history | Pass locally | `test:reservations`, `test:reservation-time-edit`; live exclusion constraint inspected |

## Actual commands and results

| Command | Exit | Result |
| --- | ---: | --- |
| `npx prisma validate` | 0 | Schema valid |
| `npx prisma migrate status` | 0 | 13 migrations applied; no pending migration |
| `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | 2 | Non-empty diff: four legacy foreign-key/index names and one `updatedAt` default differ from the Prisma model |
| `npm run typecheck` | 0 | Pass, including after audit changes |
| `npm run lint` | 0 | Pass, including after audit changes |
| `npm run build` | 0 | Production build pass, including Prisma generation after audit change |
| `npm run test:auth` | 0 | Pass |
| `npm run test:reservations` | 0 | Pass |
| `npm run test:departments` | 0 | Pass |
| `npm run test:stage6b` | 0 | Pass |
| `npm run test:stage6b1` | 1 | Fails at line 89: grouped-reservation action returned `success: false`; suite depends on a hardcoded demo login/password and seeded dates, so the exact response code needs an isolated rerun |
| `npm run test:admin-management` | 0 | Pass |
| `npm run test:admin-taxonomy` | 0 | Pass |
| `npm run test:reservation-time-edit` | 0 | Pass |
| `npm run test:timeline-range` | 0 | Pass |
| `npm run test:timeline-interactions` | 0 | Pass |
| `npm run test:office-shifts` | 1 | Safety precondition stopped suite: one real office shift is active; test requires zero |
| `npm run test:notifications` | 0 | Pass |
| `npm run test:dashboard` | 0 | Pass |
| `npm run test:stage7c4a` | 0 | Pass; repeated after the route guard change |

Integration suites used a local production server on `localhost:3002` with `SLOTIFY_RESERVATION_TEST_MODE=1`. The `test:office-shifts` precondition was respected; no active policy was replaced. Tests used isolated records and their cleanup paths. The separate MEMBER browser fixture was identity-checked and removed; follow-up counts for its user, resource, and reservation were all zero.

## MEMBER verification

A disposable MEMBER logged in using a separate Chrome session. Administration was absent from navigation; a direct visit to `/administration` returned 404. The Resources timeline offered booking details but no department reassignment or resize controls. My Reservations showed the member's own pending booking and its normal Cancel action. No cancellation was performed. Server Action tests independently returned authorization errors for MEMBER department correction, admin management, resource management, and privileged reservation operations. `currentUser()` re-reads role, activity, department, and session version from PostgreSQL rather than trusting the browser session alone.

## Database integrity

- The local PostgreSQL database reports all 13 migrations applied and Prisma schema validation passes. **Applied is not the same as drift-free:** a live-database-to-model diff returned exit 2. The `email_verification_challenges` table has two foreign-key names and two index names different from Prisma's expected names; `resource_categories.updatedAt` has a database `now()` default absent from the Prisma model. These appear to be naming/default differences rather than missing relations, but they need deliberate reconciliation or an explicit accepted-drift decision before release. No migration was created or applied in this audit. Foreign keys exist for users, resources, reservations, notifications, office shifts, correction audits, and time-change audits.
- Live `btree_gist` exists. Live `reservations_no_overlap_blocking_excl` is a GiST exclusion constraint on resource ID and `tstzrange(startTime, endTime, '[)')`, filtered to PENDING and APPROVED. It blocks across departments; adjacent intervals are allowed. A database check requires start before end.
- Reservation triggers guard active resources, department assignments, and status transitions. Integration suites verify CANCELLED/REJECTED history without availability blocking, stale writes, audit records, and persisted time changes.
- Department correction updates only department metadata and writes its audit in one transaction. Notifications and dashboard services query PostgreSQL; related integration suites pass.
- These checks cover **local PostgreSQL only**. Neon extension permissions, migrations, constraints, performance, and connection behavior remain unverified.

## Security review

- Auth.js uses an eight-hour JWT session; active status, role, and session version are checked from PostgreSQL. Passwords use Argon2. Login and sign-up have database-backed rate limits; signup validates input and always creates MEMBER users.
- The app does not override Auth.js cookie security. Auth.js defaults to secure cookies on HTTPS, but production HTTPS/cookie attributes have not been observed because no deployment exists. [Auth.js reference](https://authjs.dev/reference/core).
- Reservation, correction, shift, category, resource, user-management, and notification mutations enforce role/ownership on the server. Action wrappers return typed, non-sensitive errors for expected failures and generic database errors otherwise.
- **Fixed during audit:** `/api/reservation-test` now returns 404 on Vercel and on non-loopback hosts even if its opt-in test flag is mistakenly set. A local production server with `VERCEL=1` returned HTTP 404; the local test-enabled server still passed `test:stage7c4a`. Keep `SLOTIFY_RESERVATION_TEST_MODE` unset in every deployment. Vercel documents `VERCEL` and `VERCEL_ENV` as runtime system variables: [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).
- `.env`, `.next`, and `node_modules` are ignored and untracked. `.env.example` contains local placeholders. The tracked lockfile is `pnpm-lock.yaml`. A current-tree pattern scan found no private-key block, AWS access key ID, or `sk_live_` token. This is not a historical or comprehensive secret scan.
- Test files contain old demo login assumptions, including a fallback password string. They are test-only, but should be replaced with isolated fixtures before using the entire suite as a release gate.

## Deployment requirements and blockers

1. Resolve or explicitly accept the local schema drift listed above. Provision a separate Neon database/branch. Apply the 13 migrations with `npm run db:deploy` against a **direct** connection in a controlled release step; never use `prisma migrate dev` for production. Confirm `btree_gist`, constraint, triggers, foreign keys, model diff, and migration status on Neon. Migration was not run during this audit.
2. Configure the Vercel runtime connection for serverless pooling and test the exact Prisma 6.4.1 + Neon setup under concurrent load. The current schema has one `DATABASE_URL` and no separate `directUrl`; use a direct URL only for the controlled migration invocation and a suitable pooled URL for runtime, or explicitly configure a supported direct/pool split before release. Do not run migrations concurrently from Vercel builds. [Prisma Neon guidance](https://docs.prisma.io/docs/orm/v6/overview/databases/neon), [Prisma v6 datasource reference](https://www.prisma.io/docs/orm/v6/reference/prisma-schema-reference).
3. Set production authentication and database variables, then validate login, secure cookies, ADMIN/MEMBER access, reservation concurrency, notification updates, and audit persistence on the deployed preview. Auth.js documents `AUTH_SECRET` as mandatory and `AUTH_URL` as environment-dependent: [Auth.js installation](https://authjs.dev/getting-started/installation?framework=Next.js), [Auth.js migration guidance](https://authjs.dev/getting-started/migrating-to-v5?authentication-method=middleware).
4. Make `test:stage6b1` self-contained and run `test:office-shifts` against a disposable database or Neon branch with no active shift. Do not clear the current active local policy merely to satisfy that suite.
5. Review the uncommitted audit changes before a GitHub push. Pin and verify the Vercel Node/pnpm build environment, then perform a preview deployment and smoke test. No deployment, commit, or push was performed.

### Production environment variable checklist — names only

Required runtime:

- `DATABASE_URL`
- `AUTH_SECRET`

Deployment-dependent:

- `AUTH_URL`

Do not configure the local test/demo variables `SLOTIFY_RESERVATION_TEST_MODE`, `SLOTIFY_DEMO_ADMIN_PASSWORD`, or `SLOTIFY_DEMO_MEMBER_PASSWORD` on Vercel. `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_URL` appear only in `.env.example` and are not required by current application code.

## Changes made during this audit

- `package.json`: production build regenerates Prisma Client before Next.js build; added `db:deploy` for the controlled migration step. This addresses Vercel dependency caching described by [Prisma's Next.js deployment guidance](https://docs.prisma.io/docs/orm/v7/more/troubleshooting/nextjs).
- `src/app/api/reservation-test/route.ts`: fail closed on Vercel and non-loopback hosts.
- This report.

**Stage 8A baseline decision (superseded above): NOT READY.** The local implementation is substantially verified, but schema drift, two environment-dependent suites, and the untested Neon/Vercel deployment path remain open release gates.
