import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { businessDayBounds } from "../src/features/reservations/utils/business-date.ts";
import { officeWindow } from "../src/features/office-shifts/utils/office-window.ts";


const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(6).toString("hex");
const passphrase = `Test-${randomBytes(18).toString("base64url")}`;
const userIds = [];
let categoryId, resourceId, inactiveId;
let adminManagedId;
let initialReservationCount;
let testShift;
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
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(Date.parse(`${today}T00:00:00Z`) + Math.ceil(hoursFromNow / 4) * 86_400_000).toISOString().slice(0, 10);
  const window = officeWindow(date, testShift ?? { mode: "FULL_DAY", startMinute: 0, durationMinutes: 1440 });
  const start = new Date(window.startTime.getTime() + 60 * 60_000);
  return { startTime: start.toISOString(), endTime: new Date(start.valueOf() + minutes * 60_000).toISOString() };
}
const input = (range, resource = resourceId, title = `Test ${tag}`) => ({ resourceId: resource, title, ...range });
const find = (title) => prisma.reservation.findFirstOrThrow({ where: { title, resourceId } });

try {
  testShift = await prisma.officeShift.findFirst({ where: { isActive: true } });
  initialReservationCount = await prisma.reservation.count();
  const departmentId = (await prisma.department.findUniqueOrThrow({ where: { code: "ENG" } })).id;
  categoryId = (await prisma.resourceCategory.create({ data: { name: `Stage5A-${tag}` } })).id;
  resourceId = (await prisma.resource.create({ data: { name: `Stage5A Resource ${tag}`, location: "Test lab", categoryId } })).id;
  inactiveId = (await prisma.resource.create({ data: { name: `Stage5A Inactive ${tag}`, location: "Test lab", categoryId, isActive: false } })).id;
  for (const [name, role, isActive] of [["member1", "MEMBER", true], ["member2", "MEMBER", true], ["admin", "ADMIN", true], ["inactive", "MEMBER", false], ["admin2", "ADMIN", true]]) {
    const user = await prisma.user.create({ data: { name, email: `${name}-${tag}@example.test`, role, isActive, departmentId, passwordHash: await hash(passphrase) } });
    userIds.push(user.id);
  }
  const [member, other, admin, admin2] = await Promise.all([
    login(`member1-${tag}@example.test`, passphrase, "192.0.2.21"),
    login(`member2-${tag}@example.test`, passphrase, "192.0.2.22"),
    login(`admin-${tag}@example.test`, passphrase, "192.0.2.23"),
    login(`admin2-${tag}@example.test`, passphrase, "192.0.2.24"),
  ]);

  const main = slot(72);
  const mainTitle = `Main ${tag}`;
  fails(await action("createReservationAction", [input(main)]), "UNAUTHENTICATED");
  fails(await action("createReservationAction", [input(main, randomUUID())], member), "RESOURCE_NOT_FOUND");
  fails(await action("createReservationAction", [input(main, inactiveId)], member), "RESOURCE_INACTIVE");
  fails(await action("createReservationAction", [input({ startTime: main.endTime, endTime: main.startTime })], member), "INVALID_INPUT");
  fails(await action("createReservationAction", [input(slot(-72))], member), "INVALID_INPUT");
  fails(await action("createReservationAction", [{ ...input(main), userId: userIds[1] }], member), "INVALID_INPUT");
  fails(await action("createReservationAction", [{ ...input(main), status: "APPROVED" }], member), "INVALID_INPUT");
  pass("authentication, resource, inactive, range, and past validation");

  succeeds(await action("createReservationAction", [input(main, resourceId, mainTitle)], member));
  const created = await find(mainTitle);
  assert.equal(created.status, "PENDING");
  assert.equal(created.userId, userIds[0]);
  assert.equal(created.createdByUserId, userIds[0]);
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

  const adminSlot = slot(144);
  fails(await action("createAdminReservationAction", [{ departmentId, targetUserId: userIds[1], ...input(adminSlot) }], member), "FORBIDDEN");
  fails(await action("createAdminReservationAction", [{ departmentId, targetUserId: userIds[3], ...input(adminSlot) }], admin), "USER_INACTIVE");
  fails(await action("createAdminReservationAction", [{ departmentId, targetUserId: userIds[1], ...input(adminSlot, inactiveId) }], admin), "RESOURCE_INACTIVE");
  fails(await action("createAdminReservationAction", [{ departmentId, targetUserId: userIds[1], ...input({ startTime: adminSlot.endTime, endTime: adminSlot.startTime }) }], admin), "INVALID_INPUT");
  succeeds(await action("createAdminReservationAction", [{ departmentId, targetUserId: userIds[1], ...input(adminSlot, resourceId, `Admin booked ${tag}`) }], admin));
  const adminBooked = await find(`Admin booked ${tag}`);
  assert.equal(adminBooked.status, "APPROVED");
  assert.equal(adminBooked.userId, userIds[1]);
  assert.equal(adminBooked.createdByUserId, userIds[2]);
  fails(await action("createReservationAction", [input(adminSlot)], member), "SLOT_CONFLICT");
  fails(await action("listActiveUsersAction", [{}], member), "FORBIDDEN");
  const activeUsers = JSON.parse(await action("listActiveUsersAction", [{ search: tag, pageSize: 20 }], admin));
  succeeds(JSON.stringify(activeUsers));
  assert.ok(activeUsers.data.items.some((item) => item.id === userIds[1]));
  assert.ok(!activeUsers.data.items.some((item) => item.id === userIds[3]));
  pass("admin on-behalf approval, creator audit, active-user query, and authorization");

  const mixedRace = slot(168);
  const mixedResults = await Promise.all([
    action("createReservationAction", [input(mixedRace, resourceId, `Mixed member ${tag}`)], member),
    action("createAdminReservationAction", [{ departmentId, targetUserId: userIds[1], ...input(mixedRace, resourceId, `Mixed admin ${tag}`) }], admin),
  ]);
  assert.equal(mixedResults.filter((result) => result.includes('"success":true')).length, 1);
  assert.equal(mixedResults.filter((result) => result.includes('"code":"SLOT_CONFLICT"')).length, 1);
  assert.equal(await prisma.reservation.count({ where: { resourceId, startTime: new Date(mixedRace.startTime), status: { in: ["PENDING", "APPROVED"] } } }), 1);
  const adminRace = slot(192);
  const adminResults = await Promise.all([
    action("createAdminReservationAction", [{ departmentId, targetUserId: userIds[0], ...input(adminRace, resourceId, `Admin race A ${tag}`) }], admin),
    action("createAdminReservationAction", [{ departmentId, targetUserId: userIds[1], ...input(adminRace, resourceId, `Admin race B ${tag}`) }], admin2),
  ]);
  assert.equal(adminResults.filter((result) => result.includes('"success":true')).length, 1);
  assert.equal(adminResults.filter((result) => result.includes('"code":"SLOT_CONFLICT"')).length, 1);
  assert.equal(await prisma.reservation.count({ where: { resourceId, startTime: new Date(adminRace.startTime), status: "APPROVED" } }), 1);
  pass("member/admin and admin/admin races each have one winner");

  succeeds(await action("listOwnReservationsAction", [{ pageSize: 100 }], member));
  fails(await action("listAllReservationsAction", [{}], member), "FORBIDDEN");
  succeeds(await action("listAllReservationsAction", [{ resourceId }], admin));
  succeeds(await action("pendingReservationCountAction", [], admin));
  fails(await action("pendingReservationCountAction", [], member), "FORBIDDEN");
  const available = await action("findAvailableResourcesAction", [{ ...race, categoryId }], member);
  succeeds(available);
  assert.match(available, /"blocked"/);
  assert.doesNotMatch(available, /@example\.test|Race A|Race B/);
  fails(await action("findAvailableResourcesAction", [{ ...race, resourceId: inactiveId }], member), "RESOURCE_INACTIVE");
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(adminSlot.startTime));
  const daily = JSON.parse(await action("getDailyAvailabilityAction", [{ date: day, categoryId }], member));
  assert.ok(daily.data.blocked.some((item) => item.id === resourceId && item.intervals.some((interval) => interval.status === "APPROVED")));
  assert.ok(daily.data.inactive.some((item) => item.id === inactiveId));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  succeeds(await action("getDailyAvailabilityAction", [{ date: today, categoryId }], member));
  succeeds(await action("getDailyAvailabilityAction", [{ date: tomorrow, categoryId }], member));
  const memberDay = JSON.parse(await action("getReservationsForDateAction", [{ date: day, categoryId }], member));
  assert.ok(memberDay.data.every((item) => !("title" in item) && !("user" in item) && !("userId" in item)));
  const adminDay = JSON.parse(await action("getReservationsForDateAction", [{ date: day, categoryId }], admin));
  assert.ok(adminDay.data.some((item) => item.title === `Admin booked ${tag}` && item.user.email));
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
  fails(await action("createReservationAction", [input(midnight, resourceId, `Midnight ${tag}`)], member), "SHIFT_OUTSIDE_WINDOW");
  // The calendar boundary query still needs an isolated cross-midnight record.
  // Insert it directly so this read test does not weaken active shift validation.
  await prisma.reservation.create({ data: {
    resourceId, userId: userIds[0], createdByUserId: userIds[0], departmentId,
    title: `Midnight ${tag}`, startTime: midnight.startTime, endTime: midnight.endTime, status: "PENDING",
  } });
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
  const reservationPage = await fetch(`${base}/reservations?bookResourceId=${resourceId}`, { headers: { Cookie: cookieHeader(member) } });
  assert.equal(reservationPage.status, 200);
  const reservationHtml = await reservationPage.text();
  assert.match(reservationHtml, /Interactive Calendar/);
  assert.match(reservationHtml, /New Reservation/);
  assert.match(reservationHtml, /Stage5A Resource/);
  const adminPage = await fetch(`${base}/reservations`, { headers: { Cookie: cookieHeader(admin) } });
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /Pending Approvals/);
  const invalidResourceQuery = await fetch(`${base}/resources?categoryId=bad-uuid`, { headers: { Cookie: cookieHeader(member) } });
  assert.equal(invalidResourceQuery.status, 200);
  pass("existing resource page remains operational");

  const resourceForm = { name: `Managed ${tag}`, description: null, categoryId, location: "Test lab", capacity: 2, isActive: true };
  assert.equal(JSON.parse(await action("createResourceAction", [resourceForm], member)).success, false);
  const managed = JSON.parse(await action("createResourceAction", [resourceForm], admin));
  assert.equal(managed.success, true);
  adminManagedId = managed.data.id;
  const updated = JSON.parse(await action("updateResourceAction", [adminManagedId, { ...resourceForm, name: `Managed updated ${tag}` }], admin));
  assert.equal(updated.success, true);
  const toggled = JSON.parse(await action("toggleResourceStatusAction", [adminManagedId], admin));
  assert.equal(toggled.success, true);
  assert.equal(toggled.data.isActive, false);
  pass("resource create, update, toggle remain operational and member denied");

  assert.ok(await prisma.reservation.count({ where: { resourceId } }) >= 6);
  assert.ok(await prisma.reservation.count() >= initialReservationCount + 6);
  pass("reservation records persist");
} finally {
  if (resourceId || inactiveId) {
    const testReservations = await prisma.reservation.findMany({ where: { resourceId: { in: [resourceId, inactiveId].filter(Boolean) } }, select: { id: true } });
    await prisma.notification.deleteMany({ where: { reservationId: { in: testReservations.map((item) => item.id) } } });
  }
  if (resourceId || inactiveId) await prisma.reservation.deleteMany({ where: { resourceId: { in: [resourceId, inactiveId].filter(Boolean) } } });
  if (resourceId || inactiveId || adminManagedId) await prisma.resource.deleteMany({ where: { id: { in: [resourceId, inactiveId, adminManagedId].filter(Boolean) } } });
  if (categoryId) await prisma.resourceCategory.delete({ where: { id: categoryId } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (initialReservationCount !== undefined) assert.equal(await prisma.reservation.count(), initialReservationCount, "Existing reservation count changed");
  await prisma.$disconnect();
}
