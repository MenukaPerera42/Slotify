import { NextResponse } from "next/server";
import * as actions from "@/features/reservations/actions/reservation-actions";
import * as resourceActions from "@/features/resources/actions/resource-actions";
import * as categoryActions from "@/features/resources/actions/category-actions";
import * as notificationActions from "@/features/notifications/actions/notification-actions";
import * as departmentActions from "@/features/departments/actions/department-actions";
import * as dashboardActions from "@/features/dashboard/actions/dashboard-actions";
import * as adminUserActions from "@/features/admin-users/actions/admin-user-actions";
import * as officeShiftActions from "@/features/office-shifts/actions/office-shift-actions";
import { registerMemberAction } from "@/app/signup/actions";
import { prisma } from "@/lib/prisma";

const actionRegistry = { ...actions, ...resourceActions, ...categoryActions, ...notificationActions, ...departmentActions, ...dashboardActions, ...adminUserActions, ...officeShiftActions,
  registerMemberAction };

// Integration harness only. It is inert unless explicitly enabled in a local test server.
function enabled(request: Request) {
  const hostname = new URL(request.url).hostname;
  return process.env.SLOTIFY_RESERVATION_TEST_MODE === "1"
    && process.env.VERCEL !== "1" && !process.env.VERCEL_ENV
    && (hostname === "localhost" || hostname === "127.0.0.1");
}

export async function GET(request: Request) {
  if (!enabled(request)) return new NextResponse(null, { status: 404 });
  const rows = await prisma.$queryRaw<Array<{ database: string; marker: string | null }>>`
    SELECT current_database() AS database, shobj_description(oid, 'pg_database') AS marker
    FROM pg_database WHERE datname = current_database()`;
  return NextResponse.json(rows[0]);
}

export async function POST(request: Request) {
  if (!enabled(request)) return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new NextResponse(null, { status: 400 });
  const { name, args } = body as { name?: unknown; args?: unknown };
  if (typeof name !== "string" || !Array.isArray(args) || !(name in actionRegistry)) return new NextResponse(null, { status: 400 });
  const action = actionRegistry[name as keyof typeof actionRegistry] as (...values: unknown[]) => Promise<unknown>;
  return NextResponse.json(await action(...args));
}
