import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const source = new URL(process.env.DATABASE_URL ?? "");
assert(["localhost", "127.0.0.1", "::1"].includes(source.hostname),
  "Disposable database runner only supports a local PostgreSQL server");
assert(source.protocol === "postgresql:" || source.protocol === "postgres:");
const originalName = decodeURIComponent(source.pathname.slice(1));
assert(originalName && !originalName.startsWith("slotify_stage8a1_"), "Source database must be the main local database");
const id = randomBytes(6).toString("hex");
const name = `slotify_stage8a1_${id}`;
const marker = `slotify-stage8a1:${randomBytes(16).toString("hex")}`;
const target = new URL(source);
target.pathname = `/${name}`;
const port = process.env.SLOTIFY_ISOLATED_PORT ?? "3004";
assert(/^\d{4,5}$/.test(port));
const base = `http://localhost:${port}`;
const suites = (process.env.SLOTIFY_ISOLATED_SUITES ?? "office-shifts").split(",");
assert(suites.every((suite) => ["office-shifts", "stage7c4a", "admin-taxonomy", "stage6b1"].includes(suite)));
const pgEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
const connection = ["-h", source.hostname, "-p", source.port || "5432", "-U", decodeURIComponent(source.username)];
const isolatedEnv = { ...process.env, DATABASE_URL: target.toString(),
  AUTH_URL: base, SLOTIFY_TEST_URL: base, SLOTIFY_RESERVATION_TEST_MODE: "1",
  SLOTIFY_DISPOSABLE_DB_NAME: name, SLOTIFY_DISPOSABLE_DB_MARKER: marker };

function command(program, args, env = isolatedEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${program} exited ${code ?? signal}`)));
  });
}
function capture(program, args, env = pgEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { env, stdio: ["ignore", "pipe", "inherit"] });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${program} exited ${code}`)));
  });
}
async function markerInCatalog() {
  return capture("psql", [...connection, "-d", "postgres", "-AtX", "-v", "ON_ERROR_STOP=1", "-c",
    `SELECT COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = '${name}'`]);
}
let server;
let created = false;
try {
  const sourceIdentity = await capture("psql", [...connection, "-d", originalName, "-AtX", "-v", "ON_ERROR_STOP=1", "-c", "SELECT current_database()"]);
  assert.equal(sourceIdentity, originalName, "Source URL database identity mismatch");
  await command("createdb", [...connection, name], pgEnv);
  created = true;
  await command("psql", [...connection, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
    `COMMENT ON DATABASE \"${name}\" IS '${marker}'`], pgEnv);
  assert.equal(await markerInCatalog(), marker);
  console.log(`Disposable database verified: ${name}`);
  await command("npx", ["prisma", "migrate", "deploy"]);
  await command("npx", ["prisma", "migrate", "status"]);
  await command("npx", ["prisma", "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma",
    "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);
  const catalog = await capture("psql", [...connection, "-d", name, "-AtX", "-v", "ON_ERROR_STOP=1", "-c",
    `SELECT (SELECT count(*) FROM pg_extension WHERE extname='btree_gist'),
      (SELECT count(*) FROM pg_constraint WHERE contype='x' AND conname='reservations_no_overlap_blocking_excl'),
      (SELECT count(*) FROM pg_constraint WHERE contype='f'),
      (SELECT count(*) FROM pg_indexes WHERE schemaname='public'),
      (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal)`]);
  const [extension, exclusion, foreignKeys, indexes, triggers] = catalog.split("|").map(Number);
  assert(extension === 1 && exclusion === 1 && foreignKeys > 0 && indexes > 0 && triggers > 0,
    `Migrated catalog verification failed: ${catalog}`);
  const requiredTriggers = await capture("psql", [...connection, "-d", name, "-AtX", "-v", "ON_ERROR_STOP=1", "-c",
    `SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
      ('reservations_status_transition_guard','reservations_active_resource_guard','reservations_department_insert_guard','users_last_admin_guard')`]);
  assert.equal(requiredTriggers.split(",").length, 4, `Required triggers missing: ${requiredTriggers}`);
  console.log(`Catalog verified: btree_gist=${extension}, exclusion=${exclusion}, FKs=${foreignKeys}, indexes=${indexes}, triggers=${triggers}`);
  await command("node", ["--import", "tsx", "prisma/seed-departments.ts"]);
  await command("psql", [...connection, "-d", name, "-v", "ON_ERROR_STOP=1", "-c",
    `INSERT INTO users (id, name, email, role, "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Disposable Anchor', 'anchor-${id}@test.local', 'ADMIN', now(), now())`], pgEnv);
  server = spawn("npm", ["run", "start", "--", "-p", port], { env: isolatedEnv, stdio: "inherit" });
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error(`Test server exited ${server.exitCode}`);
    try {
      const response = await fetch(`${base}/api/reservation-test`);
      if (response.ok) {
        const identity = await response.json();
        assert.deepEqual(identity, { database: name, marker }, "Server points at the wrong database");
        break;
      }
    } catch (error) {
      if (error.code === "ERR_ASSERTION") throw error;
    }
    if (attempt === 39) throw new Error("Disposable test server did not become ready");
    await delay(500);
  }
  for (const suite of suites) await command("npm", ["run", `test:${suite}`]);
  console.log(`PASS isolated suites (${suites.join(", ")}) and migration catalog checks`);
} finally {
  if (server) {
    server.kill("SIGTERM");
    await delay(1000);
  }
  if (created) {
    const actualMarker = await markerInCatalog();
    if (actualMarker === marker) {
      await command("dropdb", [...connection, "--if-exists", "--force", name], pgEnv);
      console.log(`Removed disposable database ${name}`);
    } else {
      console.error(`Database ${name} retained because its marker did not match`);
      process.exitCode = 1;
    }
  }
}
