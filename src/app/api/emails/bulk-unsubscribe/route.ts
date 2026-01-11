import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractUnsubscribeLinks } from "@/lib/unsubscribe";

async function attemptOneClickUnsubscribe(url: string) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent":
        "JumpEmailSorter/1.0 (best-effort unsubscribe; contact: admin@example.com)",
    },
  });
  return { status: res.status, ok: res.status >= 200 && res.status < 400 };
}

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
  });

  const results: Array<{
    id: string;
    ok: boolean;
    method?: "http" | "mailto" | "none";
    url?: string;
    error?: string;
  }> = [];

  for (const e of emails) {
    try {
      const links = extractUnsubscribeLinks({
        listUnsubscribe: e.listUnsubscribe,
        bodyText: e.bodyText,
        bodyHtml: e.bodyHtml,
      });

      const http = links.httpLinks[0] ?? links.guessedLinks[0];
      if (http) {
        const attempt = await attemptOneClickUnsubscribe(http);
        await prisma.emailAction.create({
          data: {
            emailMessageId: e.id,
            type: "UNSUBSCRIBE_ATTEMPT",
            status: attempt.ok ? "SUCCEEDED" : "FAILED",
            details: { method: "http", url: http, status: attempt.status },
          },
        });
        if (attempt.ok) {
          await prisma.emailMessage.update({
            where: { id: e.id },
            data: { importStatus: "UNSUBSCRIBED" },
          });
        }
        results.push({
          id: e.id,
          ok: attempt.ok,
          method: "http",
          url: http,
          error: attempt.ok ? undefined : "http_unsubscribe_failed",
        });
        continue;
      }

      const mailto = links.mailtoLinks[0];
      if (mailto) {
        await prisma.emailAction.create({
          data: {
            emailMessageId: e.id,
            type: "UNSUBSCRIBE_ATTEMPT",
            status: "FAILED",
            details: { method: "mailto", url: mailto },
          },
        });
        results.push({ id: e.id, ok: false, method: "mailto", url: mailto, error: "mailto_unsubscribe_not_supported" });
        continue;
      }

      await prisma.emailAction.create({
        data: {
          emailMessageId: e.id,
          type: "UNSUBSCRIBE_ATTEMPT",
          status: "FAILED",
          details: { method: "none" },
        },
      });
      results.push({ id: e.id, ok: false, method: "none", error: "no_unsubscribe_link_found" });
    } catch (err) {
      await prisma.emailAction.create({
        data: {
          emailMessageId: e.id,
          type: "UNSUBSCRIBE_ATTEMPT",
          status: "FAILED",
          details: { error: String(err) },
        },
      });
      results.push({ id: e.id, ok: false, error: "unsubscribe_failed" });
    }
  }

  return NextResponse.json({ ok: true, results });
}



