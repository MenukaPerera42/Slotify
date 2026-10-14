import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { getDepartmentColorScheme } from "../src/features/departments/utils/department-colors.ts";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";

const pass = (label) => console.log(`PASS ${label}`);

try {
  console.log("--- Starting Stage 6B.1 Verification Suite ---");

  // 1. Department color mapping unit verification
  assert.equal(getDepartmentColorScheme("ENG").bg, "#DBEAFE");
  assert.equal(getDepartmentColorScheme("ENG").border, "#93C5FD");
  assert.equal(getDepartmentColorScheme("ENG").text, "#1D4ED8");

  assert.equal(getDepartmentColorScheme("FE").bg, "#E0E7FF");
  assert.equal(getDepartmentColorScheme("FE").border, "#A5B4FC");
  assert.equal(getDepartmentColorScheme("FE").text, "#3730A3");

  assert.equal(getDepartmentColorScheme("BE").bg, "#EDE9FE");
  assert.equal(getDepartmentColorScheme("BE").border, "#C4B5FD");
  assert.equal(getDepartmentColorScheme("BE").text, "#5B21B6");

  assert.equal(getDepartmentColorScheme("MOBILE").bg, "#E0F2FE");
  assert.equal(getDepartmentColorScheme("MOBILE").border, "#7DD3FC");
  assert.equal(getDepartmentColorScheme("MOBILE").text, "#0369A1");

  assert.equal(getDepartmentColorScheme("IT").bg, "#CFFAFE");
  assert.equal(getDepartmentColorScheme("IT").border, "#67E8F9");
  assert.equal(getDepartmentColorScheme("IT").text, "#155E75");

  assert.equal(getDepartmentColorScheme("HR").bg, "#EFF6FF");
  assert.equal(getDepartmentColorScheme("HR").border, "#BFDBFE");
  assert.equal(getDepartmentColorScheme("HR").text, "#1E40AF");

  // Unassigned / Legacy fallback
  assert.equal(getDepartmentColorScheme(null).bg, "#F1F5F9");
  assert.equal(getDepartmentColorScheme(null).border, "#CBD5E1");
  assert.equal(getDepartmentColorScheme(null).text, "#475569");
  assert.equal(getDepartmentColorScheme(undefined).code, "UNASSIGNED");
  pass("1. Department color palettes match exact hex specifications with deterministic unassigned fallback");

  // 2. Test getGroupedReservationsForDateAction returns correct grouped shape
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  const jar = Object.fromEntries(
    csrfRes.headers.getSetCookie().map((l) => l.split(";", 1)[0].split(/=(.*)/s).slice(0, 2))
  );
  const { csrfToken } = await csrfRes.json();

  // Admin Login
  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      csrfToken,
      email: "adminslotify@gmail.com",
      password: process.env.SLOTIFY_DEMO_ADMIN_PASSWORD || "admin@123",
      callbackUrl: `${base}/dashboard`,
    }),
  });
  assert.equal(loginRes.status, 302);
  Object.assign(
    jar,
    Object.fromEntries(loginRes.headers.getSetCookie().map((l) => l.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)))
  );

  const testAction = async (name, args) => {
    const res = await fetch(`${base}/api/reservation-test`, {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, args }),
    });
    return res.json();
  };

  // Check today's grouped reservations
  const today = "2026-10-14";
  const groupedToday = await testAction("getGroupedReservationsForDateAction", [{ date: today }]);
  assert.equal(groupedToday.success, true);
  assert(Array.isArray(groupedToday.data));
  assert(groupedToday.data.length > 0, "Today should have reservations from previous test/demo setup");
  pass("2. getGroupedReservationsForDateAction retrieves real PostgreSQL-backed occupancy");

  // Check a future empty date
  const emptyDate = "2026-11-20";
  const groupedEmpty = await testAction("getGroupedReservationsForDateAction", [{ date: emptyDate }]);
  assert.equal(groupedEmpty.success, true);
  assert.equal(groupedEmpty.data.length, 0, "Empty future date should return 0 reservations");
  pass("3. Empty date query correctly returns zero reservations for empty state rendering");

  // 3. Verify booked-only filtering semantics
  const allResources = await prisma.resource.findMany({ select: { id: true, name: true } });
  const bookedIds = new Set(groupedToday.data.map((b) => b.resourceId));
  const unbookedResources = allResources.filter((r) => !bookedIds.has(r.id));
  const bookedResources = allResources.filter((r) => bookedIds.has(r.id));

  assert(bookedResources.length > 0, "There must be booked resources on today");
  assert(unbookedResources.length > 0, "There must be unbooked resources on today to verify hiding unbooked rows");
  pass(`4. Booked resources (${bookedResources.length}) vs unbooked resources (${unbookedResources.length}) identified`);

  console.log("--- All Stage 6B.1 Functional Checks Passed Successfully! ---");
} finally {
  await prisma.$disconnect();
}

