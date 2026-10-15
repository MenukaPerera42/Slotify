# Slotify production readiness audit — Stage 8A

**Date:** 2026-10-15  
**Decision: NOT READY for deployment.** Local application checks largely pass, but a read-only schema diff found local drift, the Neon/Vercel environment has not been validated, and two legacy suites cannot pass against the current shared local database. Do not treat this report as a production smoke test.

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

**Release decision: NOT READY.** The local implementation is substantially verified, but schema drift, two environment-dependent suites, and the untested Neon/Vercel deployment path remain open release gates.
