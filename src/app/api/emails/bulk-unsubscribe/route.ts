import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractUnsubscribeLinks } from "@/lib/unsubscribe";
import { attemptUnsubscribeWithAgent } from "@/lib/unsubscribe-agent";
import {
  attemptListUnsubscribeOneClick,
  isListUnsubscribeOneClick,
} from "@/lib/unsubscribe-oneclick";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userEmail = session?.user?.email ?? null;

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
    method?: "one_click_post" | "agent" | "mailto" | "none";
    url?: string;
    steps?: Array<{ type: string; detail?: string }>;
    error?: string;
  }> = [];

  for (const e of emails) {
    try {
      const stored = (e.unsubscribeLinks ?? null) as any;
      const links =
        stored && typeof stored === "object" && Array.isArray(stored.httpLinks)
          ? {
              httpLinks: Array.isArray(stored.httpLinks) ? stored.httpLinks : [],
              guessedLinks: Array.isArray(stored.guessedLinks) ? stored.guessedLinks : [],
              mailtoLinks: Array.isArray(stored.mailtoLinks) ? stored.mailtoLinks : [],
              listUnsubscribePost:
                typeof stored.listUnsubscribePost === "string" ? stored.listUnsubscribePost : null,
            }
          : {
              ...extractUnsubscribeLinks({
                listUnsubscribe: e.listUnsubscribe,
                bodyText: e.bodyText,
                bodyHtml: e.bodyHtml,
              }),
              listUnsubscribePost: null as string | null,
            };

      // Persist latest extraction so later attempts are faster/consistent.
      await prisma.emailMessage.update({
        where: { id: e.id },
        data: {
          unsubscribeLinks: {
            httpLinks: links.httpLinks,
            guessedLinks: links.guessedLinks,
            mailtoLinks: links.mailtoLinks,
            listUnsubscribePost: links.listUnsubscribePost,
          },
        },
      });

      const http = links.httpLinks[0] ?? links.guessedLinks[0];
      if (http) {
        // Standards-based "one-click" unsubscribe: POST body "List-Unsubscribe=One-Click"
        if (isListUnsubscribeOneClick(links.listUnsubscribePost) && links.httpLinks[0] === http) {
          const attempt = await attemptListUnsubscribeOneClick({ url: http });
          await prisma.emailAction.create({
            data: {
              emailMessageId: e.id,
              type: "UNSUBSCRIBE_ATTEMPT",
              status: attempt.ok ? "SUCCEEDED" : "FAILED",
              details: {
                method: "one_click_post",
                url: http,
                status: attempt.status,
                listUnsubscribePost: links.listUnsubscribePost,
              },
            },
          });
          if (attempt.ok) {
            await prisma.emailMessage.update({
              where: { id: e.id },
              data: { importStatus: "UNSUBSCRIBED" },
            });
            results.push({ id: e.id, ok: true, method: "one_click_post", url: http });
            continue;
          }
          // If one-click POST fails, fall through to agent attempt.
        }

        const agent = await attemptUnsubscribeWithAgent({
          url: http,
          userEmail,
        });
        await prisma.emailAction.create({
          data: {
            emailMessageId: e.id,
            type: "UNSUBSCRIBE_ATTEMPT",
            status: agent.ok ? "SUCCEEDED" : "FAILED",
            details: {
              method: "agent",
              url: http,
              finalUrl: agent.finalUrl,
              steps: agent.steps,
              error: agent.ok ? null : agent.error,
            },
          },
        });
        if (agent.ok) {
          await prisma.emailMessage.update({
            where: { id: e.id },
            data: { importStatus: "UNSUBSCRIBED" },
          });
        }

        results.push({
          id: e.id,
          ok: agent.ok,
          method: "agent",
          url: http,
          steps: agent.steps,
          error: agent.ok ? undefined : agent.error,
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



