# Stage 7C.4A authentication contract

## Signup and login

`registerMemberAction(input)` from `@/app/signup/actions` accepts `{ firstName, lastName, email, departmentId, password, confirmPassword }`. Names are trimmed and required, `departmentId` must be a UUID for an active department, and `email` is trimmed, lowercased, and checked with Zod email syntax validation. The password uses the shared `passwordSchema`: 6–128 characters with a letter, number, and special character. Confirmation must match. The server writes an Argon2id hash and forces role `MEMBER`.

It returns `{ success: true, data: { email, nextPath: "/login?created=1" } }` or `{ success: false, code, error, fieldErrors? }`. Codes are `INVALID_INPUT`, `RATE_LIMITED`, `EMAIL_IN_USE`, and `DATABASE_ERROR`. The public `signupAction(previousState, formData)` is the form adapter: it returns `{ message?, fieldErrors? }` on failure and redirects to `/login?created=1` on success. Login is available immediately. The client must not navigate to `/verify-email`.

`email` syntax validation and the database's case-insensitive unique index prevent malformed and duplicate accounts. They **do not prove mailbox ownership**. No verification code or email is sent. Signup limits remain six attempts per address and 100 globally per hour, plus three per normalized email per day. Auth.js login keeps its eight-per-email, 30-per-address, and 300-global attempts per 15 minutes. `isActive=false` still blocks login and private access.

Existing users with `emailVerificationRequiredAt` set and `emailVerifiedAt` null can now sign in if active and their password is valid. These historical fields are retained but no longer authorize access. They are not backfilled or rewritten. Existing password hashes, account IDs, roles, reservations, and notification history are untouched.

## Admin-created members and email edits

`createMemberAction({ firstName, lastName, email, departmentId, initialPassword })` creates a MEMBER who can log in immediately. It uses the same email and password rules and returns a `ManagedUser` without the hash.

`updateUserProfileAction({ userId, firstName?, lastName?, email? })` is ADMIN-only. A changed `email` is validated and normalized, then updated in the existing user row under a row lock. The database unique index is the final authority for concurrent duplicate edits; conflicts return `EMAIL_CONFLICT`. A successful change clears `emailVerifiedAt` because ownership of the new address has not been demonstrated, increments `sessionVersion`, and consumes obsolete pending email-change challenges. Prior sessions fail their next authorization check; log in with the new address. A name-only or unchanged-email edit does not invalidate sessions. Account ID, role, department, `isActive`, and booking ownership remain unchanged. A member receives `FORBIDDEN`.

Old OTP Server Action exports in `@/features/email-verification/actions` are inert compatibility stubs for the current Administration frontend and return `VERIFICATION_DISABLED`; they send no mail and mutate no data. Antigravity should remove its OTP controls and call `updateUserProfileAction` directly. `/verify-email` redirects to `/login` until the obsolete route is removed. The old verification table and columns remain for history. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in an existing ignored local `.env` are unused; this stage does not edit that file. No Resend package is installed.

## Test server

Build the app, run a local server with `SLOTIFY_RESERVATION_TEST_MODE=1`, then set `SLOTIFY_TEST_URL` and run `npm run test:stage7c4a`. The test creates and removes isolated users, resources, reservations, and notifications. No email test flag or provider credentials are needed.
