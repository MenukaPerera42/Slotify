import { NextResponse } from "next/server";
import * as actions from "@/features/reservations/actions/reservation-actions";

// Integration harness only. It is inert unless explicitly enabled in a local test server.
export async function POST(request: Request) {
  if (process.env.SLOTIFY_RESERVATION_TEST_MODE !== "1") return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new NextResponse(null, { status: 400 });
  const { name, args } = body as { name?: unknown; args?: unknown };
  if (typeof name !== "string" || !Array.isArray(args) || !(name in actions)) return new NextResponse(null, { status: 400 });
  const action = actions[name as keyof typeof actions] as (...values: unknown[]) => Promise<unknown>;
  return NextResponse.json(await action(...args));
}
