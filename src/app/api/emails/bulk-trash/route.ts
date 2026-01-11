import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailClient, trashMessage } from "@/lib/gmail";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as null | {
    emailIds?: string[];
  };
  const emailIds = body?.emailIds ?? [];
  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return NextResponse.json({ error: "no_email_ids" }, { status: 400 });
  }

  const emails = await prisma.emailMessage.findMany({
    where: { userId, id: { in: emailIds } },
    include: { gmailAccount: true },
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const e of emails) {
    try {
      const gmail = getGmailClient(e.gmailAccount.refreshToken);
      await trashMessage(gmail, e.gmailMessageId);

      await prisma.emailAction.create({
        data: {
          emailMessageId: e.id,
          type: "TRASH",
          status: "SUCCEEDED",
        },
      });
      await prisma.emailMessage.delete({
        where: { id: e.id },
      });

      results.push({ id: e.id, ok: true });
    } catch (err) {
      await prisma.emailAction.create({
        data: {
          emailMessageId: e.id,
          type: "TRASH",
          status: "FAILED",
          details: { error: String(err) },
        },
      });
      results.push({ id: e.id, ok: false, error: "trash_failed" });
    }
  }

  return NextResponse.json({ ok: true, results });
}



