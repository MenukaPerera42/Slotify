import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

assert.equal(process.env.SLOTIFY_EMAIL_TEST_MODE, "1", "Start a mock-email test server and set SLOTIFY_EMAIL_TEST_MODE=1");
const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3001";
const tag = randomBytes(6).toString("hex");
const password = "abc@12";
const emails = [];
const cookieHeader = (jar) => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
const cookies = (response) => Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));
const pass = (message) => console.log(`PASS ${message}`);
let requestAddress = 1;
function otp(challenge) {
  const digest = createHmac("sha256", process.env.AUTH_SECRET)
    .update(`slotify-mock-otp:${challenge.id}:${challenge.resendCount}`).digest("hex");
  return (BigInt(`0x${digest}`) % BigInt(1_000_000)).toString().padStart(6, "0");
}
async function action(name, args = [], jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST", headers: { Origin: base, Cookie: cookieHeader(jar), "Content-Type": "application/json",
      "x-forwarded-for": `198.19.7.${(requestAddress++ % 250) + 1}` },
    body: JSON.stringify({ name, args }),
  });
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  return response.json();
}
async function login(email, secret = password) {
  const jar = {};
  const csrf = await fetch(`${base}/api/auth/csrf`);
  Object.assign(jar, cookies(csrf));
  const { csrfToken } = await csrf.json();
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookieHeader(jar), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, password: secret, callbackUrl: `${base}/dashboard` }),
  });
  Object.assign(jar, cookies(response));
  return { response, jar };
}
function ok(result) { assert.equal(result.success, true, JSON.stringify(result)); return result.data; }
function fails(result, code) { assert.equal(result.success, false, JSON.stringify(result)); assert.equal(result.code, code, JSON.stringify(result)); }
const fields = (email, departmentId, secret = password) => ({ firstName: "Stage", lastName: "Verify", email, departmentId, password: secret, confirmPassword: secret });
async function signup(email, departmentId, secret = password) {
  emails.push(email);
  return action("registerUnverifiedMemberAction", [fields(email, departmentId, secret)]);
}
async function challengeFor(email, purpose = "REGISTRATION") {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return prisma.emailVerificationChallenge.findFirstOrThrow({ where: { userId: user.id, purpose, consumedAt: null } });
}

try {
  const department = await prisma.department.findFirstOrThrow({ where: { isActive: true } });
  const invalidEmail = `invalid-${tag}@example.test`;
  for (const secret of ["abcdef", "123456", "abc123", "ab@12"]) fails(await signup(invalidEmail, department.id, secret), "INVALID_INPUT");
  assert.equal(await prisma.user.count({ where: { email: invalidEmail } }), 0);
  const email = `verified-${tag}@example.test`;
  const registered = ok(await signup(email, department.id));
  assert.equal(registered.email, email);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.role, "MEMBER");
  assert.equal(user.emailVerifiedAt, null);
  assert.ok(user.emailVerificationRequiredAt);
  assert.match(user.passwordHash, /^\$argon2id\$/);
  assert.match((await login(email)).response.headers.get("location") ?? "", /error=CredentialsSignin/);
  fails(await action("registerUnverifiedMemberAction", [fields(email, department.id)]), "EMAIL_IN_USE");
  let challenge = await challengeFor(email);
  fails(await action("verifyRegistrationOtpAction", [{ challengeId: challenge.id, code: "XXXXXX" }]), "INVALID_INPUT");
  const wrong = otp(challenge) === "999999" ? "000000" : "999999";
  fails(await action("verifyRegistrationOtpAction", [{ challengeId: challenge.id, code: wrong }]), "OTP_INVALID");
  assert.equal((await challengeFor(email)).attemptsRemaining, 4);
  fails(await action("resendRegistrationOtpAction", [email]), "RESEND_COOLDOWN");
  await prisma.emailVerificationChallenge.update({ where: { id: challenge.id }, data: { lastSentAt: new Date(Date.now() - 61_000) } });
  const previousCode = otp(challenge);
  ok(await action("resendRegistrationOtpAction", [email]));
  challenge = await challengeFor(email);
  assert.equal(challenge.resendCount, 1);
  fails(await action("verifyRegistrationOtpAction", [{ challengeId: challenge.id, code: previousCode }]), "OTP_INVALID");
  const currentCode = otp(challenge);
  const concurrent = await Promise.all([
    action("verifyRegistrationOtpAction", [{ challengeId: challenge.id, code: currentCode }]),
    action("verifyRegistrationOtpAction", [{ challengeId: challenge.id, code: currentCode }]),
  ]);
  assert.equal(concurrent.filter((item) => item.success).length, 1);
  assert.equal(concurrent.filter((item) => item.code === "OTP_INVALID").length, 1);
  fails(await action("verifyRegistrationOtpAction", [{ challengeId: challenge.id, code: currentCode }]), "OTP_INVALID");
  assert.ok((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerifiedAt);
  assert.match((await login(email)).response.headers.get("location") ?? "", /dashboard/);
  pass("signup, password policy, unverified login, resend, replay and concurrent verification");

  const limitEmail = `limit-${tag}@example.test`;
  ok(await signup(limitEmail, department.id));
  const limited = await challengeFor(limitEmail);
  const wrongLimited = otp(limited) === "999999" ? "000000" : "999999";
  for (let i = 0; i < 4; i++) fails(await action("verifyRegistrationOtpAction", [{ challengeId: limited.id, code: wrongLimited }]), "OTP_INVALID");
  fails(await action("verifyRegistrationOtpAction", [{ challengeId: limited.id, code: wrongLimited }]), "OTP_ATTEMPTS_EXCEEDED");
  fails(await action("verifyRegistrationOtpAction", [{ challengeId: limited.id, code: otp(limited) }]), "OTP_ATTEMPTS_EXCEEDED");
  const expiredEmail = `expired-${tag}@example.test`;
  ok(await signup(expiredEmail, department.id));
  const expired = await challengeFor(expiredEmail);
  await prisma.emailVerificationChallenge.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  fails(await action("verifyRegistrationOtpAction", [{ challengeId: expired.id, code: otp(expired) }]), "OTP_EXPIRED");
  const failEmail = `fail-${tag}@example.test`;
  fails(await signup(failEmail, department.id), "EMAIL_DELIVERY_FAILED");
  assert.equal(await prisma.user.count({ where: { email: failEmail } }), 0);
  pass("attempt cap, expiry and delivery rollback");

  const adminEmail = `admin-${tag}@example.test`;
  const memberEmail = `member-${tag}@example.test`;
  emails.push(adminEmail, memberEmail);
  const admin = await prisma.user.create({ data: { name: "Stage Admin", email: adminEmail, role: "ADMIN", passwordHash: await hash(password), departmentId: department.id } });
  const member = await prisma.user.create({ data: { name: "Stage Member", email: memberEmail, passwordHash: await hash(password), departmentId: department.id } });
  const adminJar = (await login(adminEmail)).jar;
  const memberJar = (await login(memberEmail)).jar;
  assert.equal((await fetch(`${base}/dashboard`, { headers: { Cookie: cookieHeader(adminJar) }, redirect: "manual" })).status, 200);
  const newEmail = `changed-${tag}@example.test`;
  emails.push(newEmail);
  fails(await action("requestAdminEmailChangeAction", [{ userId: member.id, newEmail }], memberJar), "FORBIDDEN");
  fails(await action("updateUserProfileAction", [{ userId: member.id, email: newEmail }], adminJar), "EMAIL_VERIFICATION_REQUIRED");
  const requested = ok(await action("requestAdminEmailChangeAction", [{ userId: member.id, newEmail }], adminJar));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).email, memberEmail);
  assert.match((await login(memberEmail)).response.headers.get("location") ?? "", /dashboard/);
  fails(await action("requestAdminEmailChangeAction", [{ userId: admin.id, newEmail }], adminJar), "EMAIL_IN_USE");
  const pending = await prisma.emailVerificationChallenge.findUniqueOrThrow({ where: { id: requested.challengeId } });
  assert.equal(pending.targetEmail, newEmail);
  assert.equal(pending.initiatedByUserId, admin.id);
  ok(await action("verifyPendingEmailChangeAction", [{ challengeId: pending.id, code: otp(pending) }]));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).email, newEmail);
  assert.equal((await fetch(`${base}/dashboard`, { headers: { Cookie: cookieHeader(memberJar) }, redirect: "manual" })).status, 307);
  assert.match((await login(memberEmail)).response.headers.get("location") ?? "", /error=CredentialsSignin/);
  const newLogin = await login(newEmail);
  assert.match(newLogin.response.headers.get("location") ?? "", /dashboard/);
  assert.match((await login(adminEmail)).response.headers.get("location") ?? "", /dashboard/);
  const nextEmail = `cancelled-${tag}@example.test`;
  const cancelRequest = ok(await action("requestAdminEmailChangeAction", [{ userId: member.id, newEmail: nextEmail }], adminJar));
  assert.equal(ok(await action("getPendingEmailChangeStateAction", [member.id], newLogin.jar)).targetEmail, nextEmail);
  assert.equal(ok(await action("cancelPendingEmailChangeAction", [member.id], newLogin.jar)).cancelled, true);
  assert.equal(ok(await action("getPendingEmailChangeStateAction", [member.id], newLogin.jar)), null);
  const cancelledChallenge = await prisma.emailVerificationChallenge.findUniqueOrThrow({ where: { id: cancelRequest.challengeId } });
  fails(await action("verifyPendingEmailChangeAction", [{ challengeId: cancelledChallenge.id, code: otp(cancelledChallenge) }]), "OTP_INVALID");
  pass("legacy access, admin email change, uniqueness, old-email continuity and session revocation");
} finally {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
}
