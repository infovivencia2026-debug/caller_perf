import { NextResponse } from "next/server";
import { topUpPresentCounsellors } from "@/lib/auto-assign-run";

export const dynamic = "force-dynamic";

/**
 * Scheduled morning top-up. Called by a server cron/timer with the shared secret, e.g.
 *   curl "http://127.0.0.1:3010/api/cron/auto-assign?key=$CRON_SECRET"
 * Requires CRON_SECRET to be set; without it (or on mismatch) it refuses, so it can't be
 * triggered by an anonymous request.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await topUpPresentCounsellors();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
