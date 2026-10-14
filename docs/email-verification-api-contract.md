# Stage 7C.3A email verification API contract

This is the backend contract for the Stage 7C.3B UI. All functions below are Server Actions. Results have the form `{ success: true, data }` or `{ success: false, code, error, fieldErrors? }`. Do not display provider details or any OTP/hash from server state.

## Registration

- `registerUnverifiedMemberAction({ firstName, lastName, email, password, confirmPassword, departmentId })` in `src/app/signup/actions.ts` creates an unverified MEMBER. Success data: `{ email, challengeId, nextPath, expiresAt, resendAvailableAt }`. `nextPath` is `/verify-email?email=...&challengeId=...`; Stage 7C.3B must implement that page. The existing `signupAction(SignupState, FormData)` adapter returns `{ message, verification: { email, challengeId, nextPath } }` for the current signup form. It no longer redirects to login.
- `getRegistrationVerificationStateAction(email)` returns `{ challengeId, targetEmail, expiresAt, resendAvailableAt, attemptsRemaining, status }` for a pending registration. This supports an interrupted signup and admin-created member accounts. `getVerificationStateAction(challengeId)` gives the same safe state plus purpose for either challenge type.
- `verifyRegistrationOtpAction({ challengeId, code })` returns `{ userId, email }` after successful verification. The six-digit `code` must come from the mailbox. Then send the user to `/login`.
- `resendRegistrationOtpAction(email)` returns `{ challengeId, targetEmail, expiresAt, resendAvailableAt }`. A resend replaces the prior code. It retains the same challenge ID.

Signup checks the active department under a database lock, enforces MEMBER, hashes the password with Argon2id, and sends the OTP in the creation transaction. A delivery failure rolls back both user and challenge, so the user may retry. Existing email or pending email claims return `EMAIL_IN_USE`. A created but unverified account can use resend; it cannot sign in. `isActive` remains an independent administrative flag.

New passwords are 6–128 characters and require at least one Unicode letter, number and special character. `abc@12` passes. Recommend 8 or more characters in UI copy without changing the mandatory minimum. The shared `passwordSchema` also applies to admin-created members. No password reset/change operation is currently implemented.

## Admin email changes

- `requestAdminEmailChangeAction({ userId, newEmail })` requires an active ADMIN and returns `{ challengeId, targetEmail, expiresAt, resendAvailableAt }`. It sends a code to the proposed address. `User.email` remains unchanged.
- `getPendingEmailChangeStateAction(userId)` requires the admin or account owner; returns the pending state or `null`.
- `verifyPendingEmailChangeAction({ challengeId, code })` requires possession of the code sent to the new address. It returns `{ userId, email }`, atomically changes `User.email`, marks the address verified, consumes the challenge, and increments `sessionVersion` so prior sessions fail their next authorization check.
- `cancelPendingEmailChangeAction(userId)` requires the admin or account owner and returns `{ cancelled: boolean }`.
- `updateUserProfileAction` continues to update names. Submitting a changed `email` returns `EMAIL_VERIFICATION_REQUIRED`; clients must use the request/verify actions. The old email remains the login address until verification succeeds. The new email becomes the login address afterward.

`getPendingEmailChangeStateAction` lets the account owner see a request, but no separate notification email or in-app notification is sent in this backend stage. The Stage 7C.3B UI should surface this state to the owner and offer cancellation. Admin-created members receive a registration OTP and must verify before first login.

## Security and error handling

- OTP validity: 10 minutes. Wrong attempts: at most 5 per issued code. Resend cooldown: 60 seconds. Resend requests: 5 per email per hour. Verification submissions: 20 per challenge per hour. Signup and login retain their existing database-backed limits.
- Codes are generated with `crypto.randomInt` in production and stored only as keyed HMAC-SHA256 hashes. No code or hash appears in action results. Tests have a deterministic mock code only when both `SLOTIFY_RESERVATION_TEST_MODE=1` and `SLOTIFY_EMAIL_TEST_MODE=1`.
- Row locks and a transaction serialize submissions and prevent double consumption. Partial unique indexes enforce one active challenge per user/purpose and one pending claim per normalized target email. Email uniqueness is checked again at finalization. Used challenges cannot be replayed.
- Expected codes include `INVALID_INPUT`, `EMAIL_IN_USE`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`, `RESEND_COOLDOWN`, `RATE_LIMITED`, `EMAIL_DELIVERY_FAILED`, `EMAIL_CONFIGURATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, and `NOT_FOUND`. Admin profile actions additionally use `EMAIL_VERIFICATION_REQUIRED`.

## Resend and local testing

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in the ignored `.env` file. Do not use `NEXT_PUBLIC_`. Verify the sender domain in Resend, then set `RESEND_FROM_EMAIL` to an authorized address on that domain. Resend's test sender has recipient restrictions and is unsuitable for public registration. Delivery uses Resend's supported server-side [email API](https://resend.com/aws-lambda). See [domain setup](https://resend.com/changelog/domain-claim) and [test sender restrictions](https://resend.com/changelog/v0-integration).

Automated tests must start an isolated local server with `SLOTIFY_RESERVATION_TEST_MODE=1 SLOTIFY_EMAIL_TEST_MODE=1`; the mock sends no real email. Run `SLOTIFY_TEST_URL=http://localhost:3001 SLOTIFY_EMAIL_TEST_MODE=1 npm run test:email-verification` against that server. Never enable either test flag in production. A real verified send-and-receive test remains necessary before claiming live delivery works.

## Legacy accounts

Migration leaves `emailVerifiedAt` and `emailVerificationRequiredAt` null on existing users. This preserves their current login access without asserting that their addresses were verified. Only newly created accounts set `emailVerificationRequiredAt`. A deliberate trusted backfill can set both timestamps after an operator verifies ownership through an approved process; do not infer verification from account age or role. Existing password hashes, roles, reservations and notifications are untouched.
