import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.edge");
const manifest = require("../.next/server/server-reference-manifest.json");
const signupId = Object.entries(manifest.node).find(([, entry]) => entry.exportedName === "signupAction")?.[0];
const resourceId = Object.entries(manifest.node).find(([, entry]) => entry.exportedName === "createResourceAction")?.[0];
assert.ok(signupId && resourceId, "Build the app before running this test");

const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const stamp = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const memberEmail = `stage41-${stamp}@example.test`;
const raceEmail = `stage41-race-${stamp}@example.test`;
const password = `Strong-${randomBytes(18).toString("base64url")}`;
const rateAddressBytes = randomBytes(2);
const signupRateAddress = `198.18.${rateAddressBytes[0]}.${rateAddressBytes[1]}`;
const addressNamespace = randomBytes(1)[0];
function isolatedAddress(address) {
  if (address.startsWith("192.0.2.") || address.startsWith("198.51.100.")) {
    return `198.19.${addressNamespace}.${address.split(".").at(-1)}`;
  }
  return address;
}
const prisma = new PrismaClient();
const testEmails = [memberEmail, raceEmail];

function cookies(response) {
  return Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));
}
function cookieHeader(jar) {
  return Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
}
async function action(id, args, path, address, jar = {}) {
  const body = await encodeReply(args);
  const headers = { "Next-Action": id, Origin: base, "x-forwarded-for": isolatedAddress(address), Cookie: cookieHeader(jar) };
  if (typeof body === "string") headers["Content-Type"] = "text/plain;charset=UTF-8";
  const response = await fetch(`${base}${path}`, { method: "POST", headers, body, redirect: "manual" });
  return { response, text: await response.text() };
}
async function signup(fields, address) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return action(signupId, [{}, data], "/signup", address);
}
async function login(email, secret, address) {
  address = isolatedAddress(address);
  const jar = {};
  const csrfResponse = await fetch(`${base}/api/auth/csrf`, { headers: { "x-forwarded-for": address } });
  Object.assign(jar, cookies(csrfResponse));
  const { csrfToken } = await csrfResponse.json();
  const body = new URLSearchParams({ csrfToken, email, password: secret, callbackUrl: `${base}/dashboard` });
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookieHeader(jar), "Content-Type": "application/x-www-form-urlencoded", "x-forwarded-for": address },
    body,
  });
  Object.assign(jar, cookies(response));
  return { response, jar };
}
async function page(path, jar = {}) {
  return fetch(`${base}${path}`, { redirect: "manual", headers: { Cookie: cookieHeader(jar) } });
}
function pass(label) { console.log(`PASS ${label}`); }

try {
  const signupDepartment = await prisma.department.findUniqueOrThrow({ where: { code: "ENG" } });
  const signupPage = await page("/signup");
  assert.equal(signupPage.status, 200);
  assert.match(await signupPage.text(), /logo\.png/);
  assert.match(await (await page("/login")).text(), /logo\.png/);
  const logo = await page("/logo.png");
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get("content-type"), /image\/png/);
  pass("public signup and logo asset");

  const fields = { firstName: "Stage Test", lastName: "Member", email: memberEmail, password, confirmPassword: password, departmentId: signupDepartment.id };
  assert.match((await signup({ ...fields, firstName: "" }, "192.0.2.114")).text, /firstName/);
  assert.match((await signup({ ...fields, lastName: "" }, "192.0.2.113")).text, /lastName/);
  assert.match((await signup({ ...fields, departmentId: "" }, "192.0.2.116")).text, /departmentId/);
  const inactiveDepartment = await prisma.department.create({ data: { name: `Inactive Signup ${stamp}`, code: `I${randomBytes(5).toString("hex").toUpperCase()}`, isActive: false } });
  try {
    const inactiveEmail = `inactive-dept-${stamp}@example.test`;
    assert.match((await signup({ ...fields, email: inactiveEmail, departmentId: inactiveDepartment.id }, "192.0.2.117")).text, /departmentId/);
    assert.equal(await prisma.user.count({ where: { email: inactiveEmail } }), 0);
  } finally {
    await prisma.department.delete({ where: { id: inactiveDepartment.id } });
  }
  assert.match((await signup({ ...fields, email: "bad-email" }, `192.0.2.${Math.floor(Math.random() * 100) + 1}`)).text, /fieldErrors.*email/);
  assert.match((await signup({ ...fields, password: "short", confirmPassword: "short" }, "192.0.2.101")).text, /at least 6 characters/);
  assert.match((await signup({ ...fields, confirmPassword: "wrong" }, "192.0.2.102")).text, /Passwords do not match/);
  pass("invalid email, weak password (<6 chars), mismatch");

  // Verify 6-character password is accepted
  const sixCharPass = "abc@12";
  const sixCharEmail = `stage42-six-${stamp}@example.test`;
  testEmails.push(sixCharEmail);
  const sixCharSignup = await signup({ firstName: "Six Char", lastName: "Member", email: sixCharEmail, password: sixCharPass, confirmPassword: sixCharPass, departmentId: signupDepartment.id }, "192.0.2.115");
  assert.match(sixCharSignup.response.headers.get("x-action-redirect") ?? sixCharSignup.response.headers.get("location") ?? "", /\/login\?created=1/);
  const sixCharUser = await prisma.user.findUniqueOrThrow({ where: { email: sixCharEmail } });
  assert.equal(sixCharUser.role, "MEMBER");
  assert.equal(sixCharUser.departmentId, signupDepartment.id);
  assert.equal(sixCharUser.firstName, "Six Char");
  assert.equal(sixCharUser.lastName, "Member");
  assert.ok(sixCharUser.passwordHash?.startsWith("$argon2id$"));
  assert.equal(sixCharUser.emailVerificationRequiredAt, null);
  pass("6-character password passes signup validation and creates MEMBER account");

  const created = await signup({ ...fields, email: `  ${memberEmail.toUpperCase()}  `, role: "ADMIN" }, "192.0.2.103");
  assert.match(created.response.headers.get("x-action-redirect") ?? created.response.headers.get("location") ?? "", /\/login\?created=1/);
  const newUser = await prisma.user.findUniqueOrThrow({ where: { email: memberEmail } });
  assert.equal(newUser.role, "MEMBER");
  assert.equal(newUser.departmentId, signupDepartment.id);
  assert.equal(newUser.firstName, "Stage Test");
  assert.equal(newUser.lastName, "Member");
  assert.equal(newUser.name, "Stage Test Member");
  assert.ok(newUser.passwordHash?.startsWith("$argon2id$"));
  assert.equal(newUser.emailVerifiedAt, null);
  assert.equal(newUser.emailVerificationRequiredAt, null);
  pass("signup normalizes email, hashes password, ignores injected ADMIN role");

  await assert.rejects(
    prisma.user.create({ data: { name: "Case Variant", email: memberEmail.toUpperCase(), passwordHash: newUser.passwordHash, role: "MEMBER" } }),
    (error) => error.code === "P2002",
  );
  pass("database rejects case-variant duplicate email");

  const duplicate = await signup(fields, "192.0.2.104");
  assert.match(duplicate.text, /already exists/);
  assert.equal(await prisma.user.count({ where: { email: memberEmail } }), 1);
  const concurrent = await Promise.all([
    signup({ ...fields, email: raceEmail }, "192.0.2.105"),
    signup({ ...fields, email: raceEmail, role: "ADMIN" }, "192.0.2.106"),
  ]);
  assert.equal(await prisma.user.count({ where: { email: raceEmail } }), 1);
  assert.equal(concurrent.filter(({ text }) => text.includes("already exists")).length, 1);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: raceEmail } })).role, "MEMBER");
  pass("duplicate and concurrent duplicate registration");

  const member = await login(memberEmail, password, "192.0.2.107");
  assert.equal(member.response.status, 302);
  assert.match(member.response.headers.get("location") ?? "", /dashboard/);
  assert.equal((await page("/resources", member.jar)).status, 200);
  assert.match(await (await page("/resources", member.jar)).text(), /logo\.png/);
  assert.equal((await page("/administration", member.jar)).status, 404);
  assert.equal((await page("/dashboard")).status, 307);
  const deniedAction = await action(resourceId, [{}], "/resources", "192.0.2.108", member.jar);
  assert.match(deniedAction.text, /Forbidden/);
  pass("new member login, protected routes, admin denial");

  await prisma.user.update({ where: { email: memberEmail }, data: { role: "ADMIN" } });
  assert.equal((await page("/administration", member.jar)).status, 200);
  await prisma.user.update({ where: { email: memberEmail }, data: { role: "MEMBER" } });
  assert.equal((await page("/administration", member.jar)).status, 404);
  await prisma.user.update({ where: { email: memberEmail }, data: { isActive: false } });
  assert.equal((await page("/resources", member.jar)).status, 307);
  await prisma.user.update({ where: { email: memberEmail }, data: { isActive: true } });
  pass("role changes and deactivation take effect on the next request");

  // Old admin email no longer authenticates
  const oldAdmin = await login("alex.admin@primewave.local", process.env.SLOTIFY_DEMO_ADMIN_PASSWORD, "192.0.2.110");
  assert.notEqual(oldAdmin.response.headers.get("location") ?? "", `${base}/dashboard`);
  assert.match(oldAdmin.response.headers.get("location") ?? "", /error=CredentialsSignin/);

  // Updated admin email authenticates and has ADMIN role
  const admin = await login("adminslotify@gmail.com", process.env.SLOTIFY_DEMO_ADMIN_PASSWORD, "192.0.2.109");
  assert.equal(admin.response.status, 302);
  assert.equal((await page("/administration", admin.jar)).status, 200);
  pass("updated admin login (adminslotify@gmail.com) succeeds and old admin is rejected");

  const csrfResponse = await fetch(`${base}/api/auth/csrf`, { headers: { Cookie: cookieHeader(member.jar) } });
  Object.assign(member.jar, cookies(csrfResponse));
  const { csrfToken } = await csrfResponse.json();
  const logout = await fetch(`${base}/api/auth/signout`, {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookieHeader(member.jar), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${base}/login` }),
  });
  Object.assign(member.jar, cookies(logout));
  assert.equal(logout.status, 302);
  assert.equal((await page("/resources", member.jar)).status, 307);
  pass("logout revokes the browser session");

  for (let attempt = 1; attempt <= 8; attempt++) {
    await login(memberEmail, "bad-password", `198.51.100.${attempt}`);
  }
  const throttledLogin = await login(memberEmail, password, "198.51.100.100");
  assert.match(throttledLogin.response.headers.get("location") ?? "", /login/);
  pass("login rate limit rejects a valid password after excessive attempts");

  let last;
  for (let attempt = 1; attempt <= 7; attempt++) {
    last = await signup({ ...fields, email: `bad-${attempt}` }, signupRateAddress);
  }
  assert.match(last.text, /Too many sign-up attempts/);
  pass("registration address rate limit");
} finally {
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
  await prisma.$disconnect();
}
