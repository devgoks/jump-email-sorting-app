export type UnsubscribeLinks = {
  httpLinks: string[];
  mailtoLinks: string[];
  guessedLinks: string[];
};

export function extractUnsubscribeLinks(input: {
  listUnsubscribe?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
}): UnsubscribeLinks {
  const httpLinks: string[] = [];
  const mailtoLinks: string[] = [];
  const guessedLinks: string[] = [];

  const header = input.listUnsubscribe ?? "";
  // Typical: <mailto:unsubscribe@x.com?subject=unsubscribe>, <https://x.com/unsub?...>
  const bracketed = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1]?.trim());
  const rawParts = bracketed.length > 0 ? bracketed : header.split(",");

  for (const part of rawParts) {
    const v = (part ?? "").trim();
    if (!v) continue;
    if (v.toLowerCase().startsWith("mailto:")) mailtoLinks.push(v);
    if (v.toLowerCase().startsWith("http://") || v.toLowerCase().startsWith("https://"))
      httpLinks.push(v);
  }

  const text = `${input.bodyText ?? ""}\n${stripHtml(input.bodyHtml ?? "")}`;
  // Heuristic: find any URL containing "unsubscribe" or "unsub"
  const urlMatches = [...text.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]);
  for (const u of urlMatches) {
    const lower = u.toLowerCase();
    if (lower.includes("unsubscribe") || lower.includes("unsub")) guessedLinks.push(u);
  }

  return {
    httpLinks: uniq(httpLinks),
    mailtoLinks: uniq(mailtoLinks),
    guessedLinks: uniq(guessedLinks),
  };
}

function uniq(xs: string[]) {
  return [...new Set(xs)];
}

function stripHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}




