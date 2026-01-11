import { prisma } from "@/lib/prisma";
import { classifyAndSummarizeEmail } from "@/lib/ai";
import {
  archiveMessage,
  fetchFullMessage,
  getGmailClient,
  listInboxMessageIds,
} from "@/lib/gmail";

export async function syncUserInboxes(userId: string, opts?: { maxPerInbox?: number }) {
  const maxPerInbox = opts?.maxPerInbox ?? 10;

  const [gmailAccounts, categories] = await Promise.all([
    prisma.gmailAccount.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  const ensuredCategories =
    categories.length > 0
      ? categories
      : [
          await prisma.category.create({
            data: {
              userId,
              name: "Uncategorized",
              description:
                "Catch-all category for emails that do not match other categories.",
            },
          }),
        ];

  const results: Array<{
    gmailAccountId: string;
    email: string;
    imported: number;
    skipped: number;
  }> = [];

  for (const acct of gmailAccounts) {
    const gmail = getGmailClient(acct.refreshToken);
    const joinedAtMs = BigInt(acct.createdAt.getTime());
    const ids = await listInboxMessageIds(gmail, {
      maxResults: maxPerInbox,
      q: "is:inbox newer_than:1d",
    });

    let imported = 0;
    let skipped = 0;


    for (const gmailMessageId of ids) {
      const already = await prisma.emailMessage.findUnique({
        where: {
          gmailAccountId_gmailMessageId: { gmailAccountId: acct.id, gmailMessageId },
        },
        select: { id: true },
      });
      if (already) {
        skipped += 1;
        continue;
      }

      const fetched = await fetchFullMessage(gmail, gmailMessageId);
      // To ensure we import and archive only NEW emails after the user connected their Gmail account to the app.
      if (fetched.internalDateMs && fetched.internalDateMs < joinedAtMs) {
        skipped += 1;
        continue;
      }
      //console.log("fetched.subject", fetched.subject);
      //console.log("fetched.fromEmail", fetched.fromEmail);
      const ai = await classifyAndSummarizeEmail({
        categories: ensuredCategories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
        })),
        email: {
          subject: fetched.subject,
          fromEmail: fetched.fromEmail,
          snippet: fetched.snippet,
          bodyText: fetched.bodyText,
        },
      });

      const categoryId = ai.categoryId ?? ensuredCategories[0]!.id;

      await prisma.emailMessage.create({
        data: {
          userId,
          gmailAccountId: acct.id,
          categoryId,
          gmailMessageId: fetched.gmailMessageId,
          gmailThreadId: fetched.gmailThreadId,
          internalDateMs: fetched.internalDateMs,
          fromName: fetched.fromName,
          fromEmail: fetched.fromEmail,
          subject: fetched.subject,
          snippet: fetched.snippet,
          bodyText: fetched.bodyText,
          bodyHtml: fetched.bodyHtml,
          summary: ai.summary,
          listUnsubscribe: fetched.listUnsubscribe,
        },
      });

      await archiveMessage(gmail, fetched.gmailMessageId);
      await prisma.emailMessage.update({
        where: {
          gmailAccountId_gmailMessageId: {
            gmailAccountId: acct.id,
            gmailMessageId: fetched.gmailMessageId,
          },
        },
        data: { importStatus: "ARCHIVED" },
      });

      imported += 1;
    }

    await prisma.gmailAccount.update({
      where: { id: acct.id },
      data: { lastSyncedAt: new Date() },
    });

    results.push({ gmailAccountId: acct.id, email: acct.email, imported, skipped });
  }

  return results;
}



