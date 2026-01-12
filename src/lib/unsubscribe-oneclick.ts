export function isListUnsubscribeOneClick(listUnsubscribePost: string | null | undefined) {
  const v = (listUnsubscribePost ?? "").trim();
  if (!v) return false;
  // Per RFC 8058 / common providers: "List-Unsubscribe=One-Click"
  return /list-unsubscribe\s*=\s*one-click/i.test(v);
}

export async function attemptListUnsubscribeOneClick(input: {
  url: string;
  userAgent?: string;
  timeoutMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input.url, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent":
          input.userAgent ??
          "JumpEmailSorter/1.0 (one-click unsubscribe; contact: admin@example.com)",
      },
      body: "List-Unsubscribe=One-Click",
    });

    // Providers vary; treat 2xx/3xx as success for one-click.
    const ok = res.status >= 200 && res.status < 400;
    return { ok, status: res.status };
  } finally {
    clearTimeout(t);
  }
}



