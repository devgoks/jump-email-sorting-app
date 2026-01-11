import { prisma } from "@/lib/prisma";
import { syncUserInboxes } from "@/lib/sync";

export type SyncAllUsersInboxesResultItem =
  | {
      userId: string;
      inboxes: Awaited<ReturnType<typeof syncUserInboxes>>;
      error?: never;
    }
  | {
      userId: string;
      inboxes?: never;
      error: string;
    };

export async function syncAllUsersInboxes(opts?: { maxPerInbox?: number }) {
  const maxPerInbox = opts?.maxPerInbox ?? 10;

  const users = await prisma.user.findMany({
    where: { gmailAccounts: { some: {} } },
    select: { id: true },
  });

  const results: SyncAllUsersInboxesResultItem[] = [];
  for (const u of users) {
    try {
      const inboxes = await syncUserInboxes(u.id, { maxPerInbox });
      results.push({ userId: u.id, inboxes });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ userId: u.id, error: message });
    }
  }

  return results;
}


