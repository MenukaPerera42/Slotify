import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(5).toString("hex");
const password = `Test-7${randomBytes(18).toString("base64url")}`;
const ids = { users: [], departments: [], categories: [], resources: [], reservations: [] };
const cookies = (response) => Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));
const cookieHeader = (jar) => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
async function login(email, address) {
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
async function action(name, args = [], jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST", headers: { Origin: base, Cookie: cookieHeader(jar), "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 10}` },
    body: JSON.stringify({ name, args }),
  });
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  return response.json();
}
function ok(result) { assert.equal(result.success, true, JSON.stringify(result)); return result.data; }
function fail(result, code) { assert.equal(result.success, false, JSON.stringify(result)); assert.equal(result.code, code, JSON.stringify(result)); }
const pass = (label) => console.log(`PASS ${label}`);
const resourceInput = (categoryId) => ({ name: `Taxonomy room ${tag}`, location: "Test", categoryId, capacity: 4, isActive: true });

try {
  await prisma.$queryRaw`SELECT 1`;
  const countsBefore = {
    notifications: await prisma.notification.count(),
    reservations: await prisma.reservation.count(),
  };
  const department = await prisma.department.create({ data: { name: `Taxonomy primary ${tag}`, code: `T${tag.toUpperCase()}` } });
  ids.departments.push(department.id);
  for (const [role, suffix] of [["ADMIN", "admin"], ["MEMBER", "member"]]) {
    const user = await prisma.user.create({ data: { name: suffix, email: `${suffix}-${tag}@example.test`, passwordHash: await hash(password), role, departmentId: department.id } });
    ids.users.push(user.id);
  }
  const admin = await login(`admin-${tag}@example.test`, "198.51.100.41");
  const member = await login(`member-${tag}@example.test`, "198.51.100.42");

  const managed = ok(await action("createDepartmentAction", [{ name: `Taxonomy managed ${tag}`, code: `M${tag.toUpperCase()}` }], admin));
  ids.departments.push(managed.id);
  assert.equal(ok(await action("updateDepartmentAction", [managed.id, { name: `Taxonomy edited ${tag}`, code: `E${tag.toUpperCase()}`, description: "Edited" }], admin)).description, "Edited");
  fail(await action("createDepartmentAction", [{ name: `taxonomy EDITED ${tag}`, code: `Q${tag.toUpperCase()}` }], admin), "DUPLICATE_NAME");
  fail(await action("createDepartmentAction", [{ name: `Taxonomy other ${tag}`, code: `e${tag.toUpperCase()}` }], admin), "DUPLICATE_CODE");
  assert.ok(ok(await action("listDepartmentsAction", [{ search: tag }], admin)).items.some((item) => item.id === managed.id && item._count.users === 0));
  ok(await action("setDepartmentStatusAction", [{ id: managed.id, isActive: false }], admin));
  assert.ok(!ok(await action("listSignupDepartmentsAction")).some((item) => item.id === managed.id));
  const signup = { firstName: "Taxonomy", lastName: "Signup", email: `signup-${tag}@example.test`, password, confirmPassword: password };
  fail(await action("registerMemberAction", [{ ...signup, departmentId: managed.id }]), "INVALID_INPUT");
  ok(await action("registerMemberAction", [{ ...signup, departmentId: department.id }]));
  ids.users.push((await prisma.user.findUniqueOrThrow({ where: { email: signup.email } })).id);
  ok(await action("setDepartmentStatusAction", [{ id: managed.id, isActive: true }], admin));
  fail(await action("deleteDepartmentAction", [department.id], admin), "IN_USE");
  ok(await action("deleteDepartmentAction", [managed.id], admin));
  ids.departments = ids.departments.filter((id) => id !== managed.id);
  for (const name of ["createDepartmentAction", "updateDepartmentAction", "setDepartmentStatusAction", "deleteDepartmentAction"]) {
    const args = name === "createDepartmentAction" ? [{ name: "Denied", code: "DENIED" }] : name === "updateDepartmentAction" ? [department.id, { name: "Denied" }] : name === "setDepartmentStatusAction" ? [{ id: department.id, isActive: false }] : [department.id];
    fail(await action(name, args, member), "FORBIDDEN");
  }
  pass("department CRUD, counts, duplicate checks, status, deletion, and authorization");

  const category = ok(await action("createCategoryAction", [{ name: `Taxonomy ${tag}`, description: "Created" }], admin));
  ids.categories.push(category.id);
  assert.equal(ok(await action("updateCategoryAction", [category.id, { description: "Edited" }], admin)).description, "Edited");
  fail(await action("createCategoryAction", [{ name: `taxonomy ${tag}` }], admin), "DUPLICATE_NAME");
  fail(await action("updateCategoryAction", ["bad-id", { name: "Invalid" }], admin), "INVALID_INPUT");
  assert.ok(ok(await action("listCategoriesAction", [{ search: tag }], admin)).items.some((item) => item.id === category.id && item._count.resources === 0));
  const resource = ok(await action("createResourceAction", [resourceInput(category.id)], admin));
  ids.resources.push(resource.id);
  fail(await action("deleteCategoryAction", [category.id], admin), "IN_USE");
  ok(await action("setCategoryStatusAction", [{ id: category.id, isActive: false }], admin));
  assert.ok((await prisma.resource.findUnique({ where: { id: resource.id }, include: { category: true } })).category);
  fail(await action("createResourceAction", [resourceInput(category.id)], admin), "INACTIVE_CATEGORY");
  fail(await action("createResourceAction", [resourceInput("00000000-0000-4000-8000-000000000000")], admin), "NOT_FOUND");
  ok(await action("updateResourceAction", [resource.id, { ...resourceInput(category.id), name: `Edited room ${tag}` }], admin));
  ok(await action("setCategoryStatusAction", [{ id: category.id, isActive: true }], admin));
  const unused = ok(await action("createCategoryAction", [{ name: `Unused ${tag}` }], admin));
  ids.categories.push(unused.id);
  ok(await action("deleteCategoryAction", [unused.id], admin));
  ids.categories = ids.categories.filter((id) => id !== unused.id);
  for (const name of ["createCategoryAction", "updateCategoryAction", "setCategoryStatusAction", "deleteCategoryAction"]) {
    const args = name === "createCategoryAction" ? [{ name: "Denied" }] : name === "updateCategoryAction" ? [category.id, { name: "Denied" }] : name === "setCategoryStatusAction" ? [{ id: category.id, isActive: false }] : [category.id];
    fail(await action(name, args, member), "FORBIDDEN");
  }
  assert.equal((await prisma.resource.count({ where: { categoryId: category.id } })), 1);
  assert.equal(await prisma.reservation.count(), countsBefore.reservations);
  assert.equal(await prisma.notification.count(), countsBefore.notifications);
  pass("category CRUD, resource integration, authorization, and existing history intact");
} finally {
  // Only IDs created by this test are removed, in dependent-first order.
  await prisma.reservation.deleteMany({ where: { id: { in: ids.reservations } } }).catch(() => {});
  await prisma.resource.deleteMany({ where: { id: { in: ids.resources } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } }).catch(() => {});
  await prisma.resourceCategory.deleteMany({ where: { id: { in: ids.categories } } }).catch(() => {});
  await prisma.department.deleteMany({ where: { id: { in: ids.departments } } }).catch(() => {});
  await prisma.$disconnect();
}
