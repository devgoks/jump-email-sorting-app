import OpenAI from "openai";
import { z } from "zod";

export type AgentUnsubscribeResult =
  | {
      ok: true;
      method: "agent";
      finalUrl?: string;
      steps: Array<{ type: string; detail?: string }>;
    }
  | {
      ok: false;
      method: "agent";
      error: string;
      finalUrl?: string;
      steps: Array<{ type: string; detail?: string }>;
    };

function isSafeHttpUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function looksUnsubscribedHeuristic(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("you have been unsubscribed") ||
    t.includes("you are unsubscribed") ||
    t.includes("successfully unsubscribed") ||
    t.includes("unsubscribe successful") ||
    t.includes("your preferences have been updated") ||
    t.includes("subscription updated")
  );
}

function getOpenAIIfConfigured() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

type ControlSnapshot = {
  id: string;
  kind:
    | "button"
    | "link"
    | "roleButton"
    | "clickable"
    | "input"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio";
  text?: string;
  tag?: string;
  type?: string | null;
  name?: string | null;
  placeholder?: string | null;
};

const AgentActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), targetId: z.string().min(1) }),
  z.object({ type: z.literal("clickText"), text: z.string().min(1) }),
  z.object({
    type: z.literal("clickRole"),
    role: z.enum(["button", "link", "radio", "checkbox", "option", "combobox"]),
    name: z.string().min(1),
    exact: z.boolean().optional(),
  }),
  z.object({ type: z.literal("fill"), targetId: z.string().min(1), value: z.string() }),
  z.object({ type: z.literal("select"), targetId: z.string().min(1), value: z.string() }),
  z.object({ type: z.literal("check"), targetId: z.string().min(1) }),
  z.object({ type: z.literal("uncheck"), targetId: z.string().min(1) }),
  z.object({ type: z.literal("press"), key: z.string().min(1) }),
  z.object({ type: z.literal("wait"), ms: z.number().int().min(0).max(30_000) }),
]);
type AgentAction = z.infer<typeof AgentActionSchema>;

const AgentPlanSchema = z.object({
  actions: z.array(AgentActionSchema).min(1).max(10),
});

function parseJsonBestEffort(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1]) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPageTextForAi(page: any) {
  // `innerText` can be empty on pages with no visible text (or heavily JS-driven UIs).
  const inner = (await page.innerText("body").catch(() => "")) as string;
  if (inner && inner.trim()) return { pageText: inner.trim(), source: "innerText" as const };

  const textContent = (await page.textContent("body").catch(() => "")) as string;
  if (textContent && textContent.trim())
    return { pageText: textContent.trim(), source: "textContent" as const };

  const html = (await page.content().catch(() => "")) as string;
  const stripped = stripHtmlToText(html);
  return {
    pageText: stripped,
    source: "htmlStrip" as const,
    htmlSnippet: html.slice(0, 6000),
  };
}

async function suggestActionsWithAI(input: {
  url: string;
  pageText: string;
  userEmail?: string | null;
  controls: ControlSnapshot[];
}) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const openai = getOpenAIIfConfigured();
  if (!openai) return null;

  console.log("input.pageText", input.pageText);
  console.log("input.controls", input.controls);

  const controlsText =
    input.controls
      .map((c) => {
        const bits = [
          `id=${c.id}`,
          `kind=${c.kind}`,
          c.text ? `text=${JSON.stringify(c.text)}` : null,
          c.type ? `type=${JSON.stringify(c.type)}` : null,
          c.name ? `name=${JSON.stringify(c.name)}` : null,
          c.placeholder ? `placeholder=${JSON.stringify(c.placeholder)}` : null,
        ].filter(Boolean);
        return `- ${bits.join(" | ")}`;
      })
      .join("\n") || "(none)";
  const prompt = [
    "You are an unsubscribe agent operating a web page.",
    "Given the page text and the available UI controls, output JSON ONLY.",
    "Goal: unsubscribe the user from emails/newsletters on this page.",
    "",
    `URL: ${input.url}`,
    `USER_EMAIL (use if needed): ${input.userEmail ?? "(unknown)"}`,
    "",
    "PAGE_TEXT (truncated):",
    input.pageText.slice(0, 6000),
    "",
    "CONTROLS (reference targets by id):",
    controlsText,
    "",
    'Return JSON: {"actions":[ ... ]}',
    "Allowed actions:",
    '- {"type":"click","targetId":"button:3"}',
    '- {"type":"click","targetId":"roleButton:0"}',
    '- {"type":"click","targetId":"clickable:5"}',
    '- {"type":"clickText","text":"Save preferences"}',
    '- {"type":"clickRole","role":"radio","name":"Never"}',
    '- {"type":"fill","targetId":"input:7","value":"..."}',
    '- {"type":"select","targetId":"select:0","value":"Option label or value"}',
    '- {"type":"check","targetId":"checkbox:2"}',
    '- {"type":"uncheck","targetId":"checkbox:2"}',
    '- {"type":"press","key":"Enter"}',
    '- {"type":"wait","ms":1500}',
    "Rules:",
    "- Prefer direct unsubscribe/opt-out actions over 'manage preferences' when available.",
    "- Avoid actions unrelated to unsubscribing (password reset, account deletion, purchases, etc.).",
    "- Use the USER_EMAIL when the page asks for email.",
    "- Use select ONLY with target kind=select. For radio groups, use clickRole(role=radio, name=...) or clickText(...).",
    "- Use check/uncheck ONLY with target kind=checkbox.",
    "- 1 to 10 actions max.",
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const json = parseJsonBestEffort(content);
  if (!json) return null;

  const parsed = AgentPlanSchema.safeParse(json);
  if (!parsed.success) return null;
  return parsed.data.actions;
}

async function verifyUnsubscribedWithAI(input: {
  url: string;
  pageText: string;
  userEmail?: string | null;
}) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const openai = getOpenAIIfConfigured();
  if (!openai) return null;

  console.log("input.pageText", input.pageText);
  console.log("input.pageText truncated", input.pageText.slice(0, 6000));


  const prompt = [
    "You verify whether a user has successfully unsubscribed based on the page content.",
    "Output JSON ONLY.",
    "",
    `URL: ${input.url}`,
    `USER_EMAIL: ${input.userEmail ?? "(unknown)"}`,
    "",
    "PAGE_TEXT (truncated):",
    input.pageText.slice(0, 6000),
    "",
    'Return JSON: {"unsubscribed": true|false, "confidence": 0-1, "reason": "..."}',
    "Rules:",
    "- unsubscribed=true only if the page strongly indicates the subscription is removed/unsubscribed or preferences/settings saved/updated successfully.",
    "- If the page still looks like a form asking to proceed with unsubscribe/preferences, unsubscribed=false.",
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const json = parseJsonBestEffort(content);
  if (!json) return null;

  const schema = z.object({
    unsubscribed: z.boolean(),
    confidence: z.number().min(0).max(1),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(json);
  if (!parsed.success) return null;
  return parsed.data;
}

async function buildControlSnapshot(page: any): Promise<ControlSnapshot[]> {
  const out: ControlSnapshot[] = [];

  const buttons = await page.locator("button").all().catch(() => []);
  for (let i = 0; i < Math.min(buttons.length, 30); i++) {
    const el = buttons[i]!;
    const text = ((await el.innerText().catch(() => "")) as string).trim();
    if (!text) continue;
    out.push({ id: `button:${i}`, kind: "button", text, tag: "button" });
  }

  const links = await page.locator("a").all().catch(() => []);
  for (let i = 0; i < Math.min(links.length, 30); i++) {
    const el = links[i]!;
    const text = ((await el.innerText().catch(() => "")) as string).trim();
    if (!text) continue;
    out.push({ id: `link:${i}`, kind: "link", text, tag: "a" });
  }

  // Many sites use <div role="button"> or similar.
  const roleButtons = await page.locator('[role="button"]').all().catch(() => []);
  for (let i = 0; i < Math.min(roleButtons.length, 30); i++) {
    const el = roleButtons[i]!;
    const text = ((await el.innerText().catch(() => "")) as string).trim();
    const tag =
      (((await el.evaluate((n: any) => n?.tagName).catch(() => null)) as string | null) ??
        undefined);
    if (!text) continue;
    out.push({ id: `roleButton:${i}`, kind: "roleButton", text, tag: tag?.toLowerCase() });
  }

  // Clickable elements without role (best-effort): onclick handlers on common tags.
  const clickables = await page
    .locator("div[onclick], span[onclick]")
    .all()
    .catch(() => []);
  for (let i = 0; i < Math.min(clickables.length, 30); i++) {
    const el = clickables[i]!;
    const text = ((await el.innerText().catch(() => "")) as string).trim();
    const tag =
      (((await el.evaluate((n: any) => n?.tagName).catch(() => null)) as string | null) ??
        undefined);
    if (!text) continue;
    out.push({ id: `clickable:${i}`, kind: "clickable", text, tag: tag?.toLowerCase() });
  }

  const inputs = await page.locator("input").all().catch(() => []);
  for (let i = 0; i < Math.min(inputs.length, 40); i++) {
    const el = inputs[i]!;
    const type = ((await el.getAttribute("type").catch(() => null)) as string | null) ?? null;
    const name = ((await el.getAttribute("name").catch(() => null)) as string | null) ?? null;
    const placeholder =
      ((await el.getAttribute("placeholder").catch(() => null)) as string | null) ?? null;
    const t = (type ?? "").toLowerCase();
    if (t === "checkbox") {
      out.push({ id: `checkbox:${i}`, kind: "checkbox", type, name, placeholder });
      continue;
    }
    if (t === "radio") {
      out.push({ id: `radio:${i}`, kind: "radio", type, name, placeholder });
      continue;
    }
    out.push({ id: `input:${i}`, kind: "input", type, name, placeholder });
  }

  const textareas = await page.locator("textarea").all().catch(() => []);
  for (let i = 0; i < Math.min(textareas.length, 20); i++) {
    const el = textareas[i]!;
    const name = ((await el.getAttribute("name").catch(() => null)) as string | null) ?? null;
    const placeholder =
      ((await el.getAttribute("placeholder").catch(() => null)) as string | null) ?? null;
    out.push({ id: `textarea:${i}`, kind: "textarea", name, placeholder });
  }

  const selects = await page.locator("select").all().catch(() => []);
  for (let i = 0; i < Math.min(selects.length, 20); i++) {
    const el = selects[i]!;
    const name = ((await el.getAttribute("name").catch(() => null)) as string | null) ?? null;
    out.push({ id: `select:${i}`, kind: "select", name });
  }

  return out;
}

async function executeAction(page: any, action: AgentAction) {
  const waitDom = async () => {
    await page.waitForLoadState("domcontentloaded").catch(() => null);
  };

  if (action.type === "wait") {
    await page.waitForTimeout(action.ms).catch(() => null);
    return;
  }
  if (action.type === "press") {
    await page.keyboard.press(action.key).catch(() => null);
    await waitDom();
    return;
  }
  if (action.type === "clickText") {
    // Useful for "button-like" <div>/<span> controls without role/onclick attributes.
    await page
      .getByText(action.text, { exact: false })
      .first()
      .click({ timeout: 10_000 })
      .catch(() => null);
    await waitDom();
    return;
  }
  if (action.type === "clickRole") {
    await page
      .getByRole(action.role as any, { name: action.name, exact: action.exact ?? false })
      .first()
      .click({ timeout: 10_000 })
      .catch(() => null);
    await waitDom();
    return;
  }

  const [kind, idxRaw] = action.targetId.split(":");
  const idx = Number(idxRaw);
  if (!Number.isFinite(idx) || idx < 0) return;

  const locator = (() => {
    if (kind === "button") return page.locator("button").nth(idx);
    if (kind === "link") return page.locator("a").nth(idx);
    if (kind === "roleButton") return page.locator('[role="button"]').nth(idx);
    if (kind === "clickable") return page.locator("div[onclick], span[onclick]").nth(idx);
    if (kind === "input") return page.locator("input").nth(idx);
    if (kind === "checkbox") return page.locator("input").nth(idx);
    if (kind === "radio") return page.locator("input").nth(idx);
    if (kind === "textarea") return page.locator("textarea").nth(idx);
    if (kind === "select") return page.locator("select").nth(idx);
    return null;
  })();
  if (!locator) return;

  if (action.type === "click") {
    await locator.first().click({ timeout: 10_000 }).catch(() => null);
    await waitDom();
    return;
  }
  if (action.type === "fill") {
    await locator.first().fill(action.value).catch(() => null);
    return;
  }
  if (action.type === "select") {
    // If the AI incorrectly tries to "select" on a radio input, interpret it as choosing that option.
    if (kind === "radio") {
      await page
        .getByRole("radio", { name: action.value, exact: false })
        .first()
        .click({ timeout: 10_000 })
        .catch(async () => {
          await page
            .getByText(action.value, { exact: false })
            .first()
            .click({ timeout: 10_000 })
            .catch(() => null);
        });
      await waitDom();
      return;
    }
    await locator.first().selectOption({ label: action.value }).catch(async () => {
      await locator.first().selectOption({ value: action.value }).catch(() => null);
    });
    return;
  }
  if (action.type === "check") {
    await locator.first().check().catch(() => null);
    return;
  }
  if (action.type === "uncheck") {
    await locator.first().uncheck().catch(() => null);
    return;
  }
}

export async function attemptUnsubscribeWithAgent(input: {
  url: string;
  userEmail?: string | null;
  timeoutMs?: number;
}): Promise<AgentUnsubscribeResult> {
  const steps: Array<{ type: string; detail?: string }> = [];

  if (!isSafeHttpUrl(input.url)) {
    return { ok: false, method: "agent", error: "invalid_url", steps };
  }

  // Dynamic import so the app can run without Playwright installed.
  // NOTE: done via Function() so TS doesn't require the module at type-check time.
  const dynamicImport: (m: string) => Promise<any> = new Function(
    "m",
    "return import(m)"
  ) as any;
  const pw: any = await dynamicImport("playwright").catch(() => null);
  if (!pw?.chromium) {
    return { ok: false, method: "agent", error: "playwright_not_installed", steps };
  }

  const timeoutMs = input.timeoutMs ?? 45_000;
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "JumpEmailSorter/1.0 (agentic unsubscribe; contact: admin@example.com)",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    steps.push({ type: "goto", detail: input.url });
    const nav = await page.goto(input.url, { waitUntil: "domcontentloaded" });
    // Best-effort extra wait for JS-driven pages; ignore timeout.
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => null);
    steps.push({
      type: "nav",
      detail: JSON.stringify({
        status: typeof nav?.status === "function" ? nav.status() : null,
        url: page.url(),
        title: (await page.title().catch(() => null)) as string | null,
      }),
    });

    if (!getOpenAIIfConfigured()) {
      steps.push({ type: "openai_not_configured" });
      return {
        ok: false,
        method: "agent",
        error: "openai_not_configured",
        finalUrl: page.url(),
        steps,
      };
    }

    // AI-first: plan -> execute (all actions) -> AI verify. Up to 2 rounds.
    for (let round = 1; round <= 2; round++) {
      const snapshot = await getPageTextForAi(page);
      const pageText = snapshot.pageText;
      steps.push({
        type: "page_snapshot",
        detail: JSON.stringify({
          round,
          source: snapshot.source,
          textLen: pageText.length,
          textHead: pageText.slice(0, 200),
          url: page.url(),
        }),
      });

      // Early exit: page already indicates user is unsubscribed / preferences already saved.
      const preVerify = await verifyUnsubscribedWithAI({
        url: page.url(),
        pageText,
        userEmail: input.userEmail ?? null,
      });
      if (preVerify) {
        steps.push({ type: "ai_preverify", detail: JSON.stringify(preVerify) });
        if (preVerify.unsubscribed && preVerify.confidence >= 0.6) {
          return { ok: true, method: "agent", finalUrl: page.url(), steps };
        }
      } else {
        // Defensive fallback if verify parsing fails.
        const heuristic = looksUnsubscribedHeuristic(pageText);
        steps.push({ type: "heuristic_preverify", detail: String(heuristic) });
        if (heuristic) return { ok: true, method: "agent", finalUrl: page.url(), steps };
      }

      const controls = await buildControlSnapshot(page);

      const plan = await suggestActionsWithAI({
        url: page.url(),
        pageText,
        userEmail: input.userEmail ?? null,
        controls,
      });

      if (!plan?.length) {
        return {
          ok: false,
          method: "agent",
          error: "ai_plan_unavailable",
          finalUrl: page.url(),
          steps,
        };
      }

      steps.push({ type: "ai_plan", detail: JSON.stringify({ round, actions: plan }) });
      for (const a of plan) {
        steps.push({ type: "ai_action", detail: JSON.stringify(a) });
        await executeAction(page, a);
      }

      await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => null);
      const afterSnapshot = await getPageTextForAi(page);
      const afterText = afterSnapshot.pageText;
      steps.push({
        type: "page_snapshot_after",
        detail: JSON.stringify({
          round,
          source: afterSnapshot.source,
          textLen: afterText.length,
          textHead: afterText.slice(0, 200),
          url: page.url(),
        }),
      });
      const verify = await verifyUnsubscribedWithAI({
        url: page.url(),
        pageText: afterText,
        userEmail: input.userEmail ?? null,
      });
      if (verify) {
        steps.push({ type: "ai_verify", detail: JSON.stringify(verify) });
        if (verify.unsubscribed && verify.confidence >= 0.6) {
          return { ok: true, method: "agent", finalUrl: page.url(), steps };
        }
      } else {
        // Defensive fallback: if AI verify fails to parse for any reason.
        const heuristic = looksUnsubscribedHeuristic(afterText);
        steps.push({ type: "heuristic_verify", detail: String(heuristic) });
        if (heuristic) return { ok: true, method: "agent", finalUrl: page.url(), steps };
      }
    }

    return {
      ok: false,
      method: "agent",
      error: "agent_did_not_confirm_unsubscribe",
      finalUrl: page.url(),
      steps,
    };
  } catch (err) {
    return {
      ok: false,
      method: "agent",
      error: String(err),
      steps,
    };
  } finally {
    await browser.close().catch(() => null);
  }
}


