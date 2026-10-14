import { NextResponse } from "next/server";
import * as actions from "@/features/reservations/actions/reservation-actions";
import * as resourceActions from "@/features/resources/actions/resource-actions";
import * as notificationActions from "@/features/notifications/actions/notification-actions";
import * as departmentActions from "@/features/departments/actions/department-actions";
import * as dashboardActions from "@/features/dashboard/actions/dashboard-actions";

const actionRegistry = { ...actions, ...resourceActions, ...notificationActions, ...departmentActions, ...dashboardActions };

// Integration harness only. It is inert unless explicitly enabled in a local test server.
export async function POST(request: Request) {
  if (process.env.SLOTIFY_RESERVATION_TEST_MODE !== "1") return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new NextResponse(null, { status: 400 });
  const { name, args } = body as { name?: unknown; args?: unknown };
  if (typeof name !== "string" || !Array.isArray(args) || !(name in actionRegistry)) return new NextResponse(null, { status: 400 });
  const action = actionRegistry[name as keyof typeof actionRegistry] as (...values: unknown[]) => Promise<unknown>;
  return NextResponse.json(await action(...args));
}
