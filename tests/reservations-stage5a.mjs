import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { businessDayBounds } from "../src/features/reservations/utils/business-date.ts";


const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(6).toString("hex");
const passphrase = `Test-${randomBytes(18).toString("base64url")}`;
const userIds = [];
let categoryId, resourceId, inactiveId;
let initialReservationCount;
const pass = (name) => console.log(`PASS ${name}`);

function cookies(response) {
  return Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));
}
function cookieHeader(jar) { return Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; "); }
async function login(email, password, address) {
  const jar = {};
  const csrf = await fetch(`${base}/api/auth/csrf`, { headers: { "x-forwarded-for": address } });
  Object.assign(jar, cookies(csrf));
  const { csrfToken } = await csrf.json();
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookieHeader(jar), "Content-Type": "application/x-www-form-urlencoded", "x-forwarded-for": address },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${base}/dashboard` }),
  });
  assert.equal(response.status, 302);
  Object.assign(jar, cookies(response));
  return jar;
}
async function action(name, args, jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST", headers: { Origin: base, Cookie: cookieHeader(jar), "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }), redirect: "manual",
  });
  const text = await response.text();
  assert.equal(response.status, 200, `${name}: ${response.status} ${text.slice(0, 300)}`);
  return text;
}
function succeeds(text) { assert.match(text, /"success":true/); }
function fails(text, code) { assert.match(text, new RegExp(`"code":"${code}"`)); }
function slot(hoursFromNow, minutes = 60) {
  const start = new Date(Date.now() + hoursFromNow * 3600_000);
  start.setUTCSeconds(0, 0);
  return { startTime: start.toISOString(), endTime: new Date(start.valueOf() + minutes * 60_000).toISOString() };
}
const input = (range, resource = resourceId, title = `Test ${tag}`) => ({ resourceId: resource, title, ...range });
const find = (title) => prisma.reservation.findFirstOrThrow({ where: { title, resourceId } });

try {
  initialReservationCount = await prisma.reservation.count();
  categoryId = (await prisma.resourceCategory.create({ data: { name: `Stage5A-${tag}` } })).id;
  resourceId = (await prisma.resource.create({ data: { name: `Stage5A Resource ${tag}`, location: "Test lab", categoryId } })).id;
  inactiveId = (await prisma.resource.create({ data: { name: `Stage5A Inactive ${tag}`, location: "Test lab", categoryId, isActive: false } })).id;
  for (const [name, role] of [["member1", "MEMBER"], ["member2", "MEMBER"], ["admin", "ADMIN"]]) {
    const user = await prisma.user.create({ data: { name, email: `${name}-${tag}@example.test`, role, passwordHash: await hash(passphrase) } });
    userIds.push(user.id);
  }
  const [member, other, admin] = await Promise.all([
    login(`member1-${tag}@example.test`, passphrase, "192.0.2.21"),
    login(`member2-${tag}@example.test`, passphrase, "192.0.2.22"),
    login(`admin-${tag}@example.test`, passphrase, "192.0.2.23"),
  ]);

  const main = slot(72);
  const mainTitle = `Main ${tag}`;
  fails(await action("createReservationAction", [input(main)]), "UNAUTHENTICATED");
  fails(await action("createReservationAction", [input(main, randomUUID())], member), "RESOURCE_NOT_FOUND");
  fails(await action("createReservationAction", [input(main, inactiveId)], member), "RESOURCE_INACTIVE");
  fails(await action("createReservationAction", [input({ startTime: main.endTime, endTime: main.startTime })], member), "INVALID_INPUT");
  fails(await action("createReservationAction", [input(slot(-72))], member), "INVALID_INPUT");
  pass("authentication, resource, inactive, range, and past validation");

  succeeds(await action("createReservationAction", [input(main, resourceId, mainTitle)], member));
  const created = await find(mainTitle);
  assert.equal(created.status, "PENDING");
  assert.equal(created.userId, userIds[0]);
  assert.equal(created.startTime.toISOString(), main.startTime);
  assert.equal(created.endTime.toISOString(), main.endTime);
  fails(await action("createReservationAction", [input(main)], other), "SLOT_CONFLICT");
  const partial = { startTime: new Date(Date.parse(main.startTime) + 30 * 60_000).toISOString(), endTime: new Date(Date.parse(main.endTime) + 30 * 60_000).toISOString() };
  const contained = { startTime: new Date(Date.parse(main.startTime) + 15 * 60_000).toISOString(), endTime: new Date(Date.parse(main.startTime) + 45 * 60_000).toISOString() };
  fails(await action("createReservationAction", [input(partial)], other), "SLOT_CONFLICT");
  fails(await action("createReservationAction", [input(contained)], other), "SLOT_CONFLICT");
  const adjacent = { startTime: main.endTime, endTime: new Date(Date.parse(main.endTime) + 3600_000).toISOString() };
  succeeds(await action("createReservationAction", [input(adjacent, resourceId, `Adjacent ${tag}`)], other));
  pass("pending blocks exact, partial, contained; adjacent succeeds; UTC persists");

  fails(await action("approveReservationAction", [created.id], member), "FORBIDDEN");
  fails(await action("rejectReservationAction", [created.id], member), "FORBIDDEN");
  fails(await action("cancelReservationAction", [created.id], other), "RESERVATION_NOT_FOUND");
  succeeds(await action("approveReservationAction", [created.id], admin));
  assert.equal((await find(mainTitle)).status, "APPROVED");
  fails(await action("createReservationAction", [input(main)], other), "SLOT_CONFLICT");
  fails(await action("approveReservationAction", [created.id], admin), "INVALID_STATUS_TRANSITION");
  fails(await action("rejectReservationAction", [created.id], admin), "INVALID_STATUS_TRANSITION");
  pass("approval, role guards, approved blocking, and stale transition");

  succeeds(await action("cancelReservationAction", [created.id], admin));
  assert.equal((await find(mainTitle)).status, "CANCELLED");
  succeeds(await action("createReservationAction", [input(main, resourceId, `After cancel ${tag}`)], other));
  const afterCancel = await find(`After cancel ${tag}`);
  succeeds(await action("cancelReservationAction", [afterCancel.id], other));
  pass("admin and owner cancellation release slots");

  succeeds(await action("createReservationAction", [input(main, resourceId, `Reject ${tag}`)], member));
  const rejection = await find(`Reject ${tag}`);
  succeeds(await action("rejectReservationAction", [rejection.id], admin));
  assert.equal((await find(`Reject ${tag}`)).status, "REJECTED");
  succeeds(await action("createReservationAction", [input(main, resourceId, `After reject ${tag}`)], other));
  pass("rejection releases slot and history persists");

  const race = slot(96);
  const raceResults = await Promise.all([
    action("createReservationAction", [input(race, resourceId, `Race A ${tag}`)], member),
    action("createReservationAction", [input(race, resourceId, `Race B ${tag}`)], other),
  ]);
  assert.equal(raceResults.filter((result) => result.includes('"success":true')).length, 1);
  assert.equal(raceResults.filter((result) => result.includes('"code":"SLOT_CONFLICT"')).length, 1);
  assert.equal(await prisma.reservation.count({ where: { resourceId, startTime: new Date(race.startTime), status: "PENDING" } }), 1);
  pass("concurrent overlapping requests: one success, one SLOT_CONFLICT");

  const decisions = slot(120);
  succeeds(await action("createReservationAction", [input(decisions, resourceId, `Decisions ${tag}`)], member));
  const decision = await find(`Decisions ${tag}`);
  const outcomes = await Promise.all([
    action("approveReservationAction", [decision.id], admin),
    action("rejectReservationAction", [decision.id], admin),
  ]);
  assert.equal(outcomes.filter((result) => result.includes('"success":true')).length, 1);
  assert.equal(outcomes.filter((result) => result.includes('"code":"INVALID_STATUS_TRANSITION"')).length, 1);
  pass("concurrent admin decisions: one transition succeeds");

  succeeds(await action("listOwnReservationsAction", [{ pageSize: 100 }], member));
  fails(await action("listAllReservationsAction", [{}], member), "FORBIDDEN");
  succeeds(await action("listAllReservationsAction", [{ resourceId }], admin));
  succeeds(await action("pendingReservationCountAction", [], admin));
  fails(await action("pendingReservationCountAction", [], member), "FORBIDDEN");
  const available = await action("findAvailableResourcesAction", [{ ...race, categoryId }], member);
  succeeds(available);
  assert.match(available, /"blocked"/);
  assert.doesNotMatch(available, /@example\.test|Race A|Race B/);
  pass("list and availability authorization and privacy");

  const bounds = businessDayBounds("2026-10-15");
  assert.equal(bounds.start.toISOString(), "2026-10-14T18:30:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-10-15T18:30:00.000Z");
  const dateText = await action("getReservationsForDateAction", [{ date: "2026-10-15", categoryId }], member);
  succeeds(dateText);
  assert.doesNotMatch(dateText, /@example\.test|"title":|"userId":/);
  const futureDay = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const futureBounds = businessDayBounds(futureDay);
  const midnight = {
    startTime: new Date(futureBounds.start.valueOf() - 10 * 60_000).toISOString(),
    endTime: new Date(futureBounds.start.valueOf() + 10 * 60_000).toISOString(),
  };
  succeeds(await action("createReservationAction", [input(midnight, resourceId, `Midnight ${tag}`)], member));
  const onDay = JSON.parse(await action("getReservationsForDateAction", [{ date: futureDay, resourceId }], member));
  assert.ok(onDay.data.some((item) => item.resourceId === resourceId && item.startTime === midnight.startTime));
  assert.ok(onDay.data.every((item) => !("title" in item) && !("userId" in item)));
  const nextDay = new Date(Date.parse(`${futureDay}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const afterDay = JSON.parse(await action("getReservationsForDateAction", [{ date: nextDay, resourceId }], member));
  assert.ok(afterDay.data.every((item) => item.startTime !== midnight.startTime));
  pass("Colombo day boundaries and member calendar privacy");

  const resourcePage = await fetch(`${base}/resources`, { headers: { Cookie: cookieHeader(member) } });
  assert.equal(resourcePage.status, 200);
  assert.match(await resourcePage.text(), /Stage5A Resource/);
  pass("existing resource page remains operational");

  assert.ok(await prisma.reservation.count({ where: { resourceId } }) >= 6);
  assert.ok(await prisma.reservation.count() >= initialReservationCount + 6);
  pass("reservation records persist");
} finally {
  if (resourceId || inactiveId) await prisma.reservation.deleteMany({ where: { resourceId: { in: [resourceId, inactiveId].filter(Boolean) } } });
  if (resourceId || inactiveId) await prisma.resource.deleteMany({ where: { id: { in: [resourceId, inactiveId].filter(Boolean) } } });
  if (categoryId) await prisma.resourceCategory.delete({ where: { id: categoryId } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (initialReservationCount !== undefined) assert.equal(await prisma.reservation.count(), initialReservationCount, "Existing reservation count changed");
  await prisma.$disconnect();
}
