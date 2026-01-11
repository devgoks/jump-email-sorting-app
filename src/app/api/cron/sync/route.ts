import { NextResponse } from "next/server";
import { syncAllUsersInboxes } from "@/lib/sync-all-users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await syncAllUsersInboxes({ maxPerInbox: 10 });

  return NextResponse.json({ ok: true, results });
}



