import { google } from "googleapis";

export type GmailClient = ReturnType<typeof google.gmail>;

function getOAuth2Client(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export function getGmailClient(refreshToken: string) {
  const auth = getOAuth2Client(refreshToken);
  return google.gmail({ version: "v1", auth });
}

function base64UrlDecode(input: string) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}

function findHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
) {
  const lower = name.toLowerCase();
  return headers?.find((h) => (h.name ?? "").toLowerCase() === lower)?.value;
}

export function parseFromHeader(fromHeader: string | undefined) {
  if (!fromHeader) return { fromName: undefined, fromEmail: undefined };

  // Common formats:
  //   Name <email@domain.com>
  //   "Name, Inc." <email@domain.com>
  //   email@domain.com
  const match = fromHeader.match(/^(?:"?([^"]*)"?\s)?<?([^<>\s]+@[^<>\s]+)>?$/);
  if (!match) return { fromName: fromHeader, fromEmail: undefined };
  const fromName = match[1]?.trim() || undefined;
  const fromEmail = match[2]?.trim() || undefined;
  return { fromName, fromEmail };
}

function walkPartsForBodies(
  part:
    | {
        mimeType?: string | null;
        body?: { data?: string | null } | null;
        parts?: any[] | null;
      }
    | undefined,
  acc: { text?: string; html?: string }
) {
  if (!part) return acc;
  const mimeType = part.mimeType ?? undefined;
  const data = part.body?.data ?? undefined;

  if (mimeType === "text/plain" && data && !acc.text) acc.text = base64UrlDecode(data);
  if (mimeType === "text/html" && data && !acc.html) acc.html = base64UrlDecode(data);

  const parts = Array.isArray(part.parts) ? part.parts : [];
  for (const p of parts) walkPartsForBodies(p, acc);
  return acc;
}

export type GmailFetchedMessage = {
  gmailMessageId: string;
  gmailThreadId?: string;
  internalDateMs?: bigint;
  subject?: string;
  snippet?: string;
  fromName?: string;
  fromEmail?: string;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
  bodyText?: string;
  bodyHtml?: string;
};

export async function fetchFullMessage(
  gmail: GmailClient,
  gmailMessageId: string
): Promise<GmailFetchedMessage> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: gmailMessageId,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const subject = findHeader(headers, "Subject") ?? undefined;
  const fromHeader = findHeader(headers, "From") ?? undefined;
  const listUnsubscribe = findHeader(headers, "List-Unsubscribe") ?? undefined;
  const listUnsubscribePost = findHeader(headers, "List-Unsubscribe-Post") ?? undefined;
  const { fromName, fromEmail } = parseFromHeader(fromHeader);

  const { text, html } = walkPartsForBodies(msg.payload as any, {});

  return {
    gmailMessageId: msg.id ?? gmailMessageId,
    gmailThreadId: msg.threadId ?? undefined,
    internalDateMs: msg.internalDate ? BigInt(msg.internalDate) : undefined,
    subject,
    snippet: msg.snippet ?? undefined,
    fromName,
    fromEmail,
    listUnsubscribe,
    listUnsubscribePost,
    bodyText: text,
    bodyHtml: html,
  };
}

export async function archiveMessage(gmail: GmailClient, gmailMessageId: string) {
  await gmail.users.messages.modify({
    userId: "me",
    id: gmailMessageId,
    requestBody: { removeLabelIds: ["INBOX"] },
  });
}

export async function trashMessage(gmail: GmailClient, gmailMessageId: string) {
  await gmail.users.messages.trash({ userId: "me", id: gmailMessageId });
}

export async function listInboxMessageIds(
  gmail: GmailClient,
  opts?: { maxResults?: number; q?: string }
) {
  const maxResults = opts?.maxResults ?? 25;
  const q = opts?.q ?? "is:inbox";

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q,
  });

  const ids = (res.data.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === "string");

  return ids;
}


