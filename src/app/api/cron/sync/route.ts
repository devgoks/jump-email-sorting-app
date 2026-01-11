import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncUserInboxes } from "@/lib/sync";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { gmailAccounts: { some: {} } },
    select: { id: true },
  });

  const results = [];
  for (const u of users) {
    const r = await syncUserInboxes(u.id, { maxPerInbox: 10 });
    results.push({ userId: u.id, inboxes: r });
  }

  return NextResponse.json({ ok: true, results });
}



