import OpenAI from "openai";
import { z } from "zod";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  return new OpenAI({ apiKey });
}

export type AiCategory = { id: string; name: string; description: string };
export type AiEmail = {
  subject?: string;
  fromEmail?: string;
  snippet?: string;
  bodyText?: string;
};

const AiResultSchema = z.object({
  categoryName: z.string().min(1),
  summary: z.string().min(1),
  unsubscribeUrls: z.array(z.string().min(1)).optional(),
});

export async function classifyAndSummarizeEmail(input: {
  categories: AiCategory[];
  email: AiEmail;
}) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const openai = getOpenAI();

  const categoriesText = input.categories
    .map((c) => `- ${c.name}: ${c.description}`)
    .join("\n");

  const emailText = [
    input.email.subject ? `Subject: ${input.email.subject}` : "",
    input.email.fromEmail ? `From: ${input.email.fromEmail}` : "",
    input.email.snippet ? `Snippet: ${input.email.snippet}` : "",
    input.email.bodyText ? `Body:\n${input.email.bodyText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You classify emails into user-defined categories, write concise summaries, and extract unsubscribe URLs when present. Respond with ONLY valid JSON.",
      },
      {
        role: "user",
        content: [
          "Categories (name + description):",
          categoriesText || "(no categories provided)",
          "",
          "Email:",
          emailText || "(no email content provided)",
          "",
          'Return JSON: {"categoryName": "...", "summary": "...", "unsubscribeUrls": ["https://..."]}',
          "Rules:",
          "- categoryName MUST exactly match one of the provided category names when possible.",
          "- summary should be 2-5 sentences, capturing action items and key details.",
          "- If the email contains an unsubscribe link in the body, include it in unsubscribeUrls.",
          "- unsubscribeUrls should include only URLs (http/https) that look like unsubscribe/preferences opt-out endpoints.",
          "- If none found, omit unsubscribeUrls or use an empty array.",
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = AiResultSchema.safeParse(safeJsonParse(content));
  if (!parsed.success) {
    return {
      categoryId: input.categories[0]?.id,
      summary: input.email.snippet || "(No summary available.)",
      unsubscribeUrls: [],
      raw: content,
    };
  }

  const categoryName = parsed.data.categoryName.trim();
  const match = input.categories.find((c) => c.name === categoryName);

  return {
    categoryId: match?.id ?? input.categories[0]?.id,
    summary: parsed.data.summary.trim(),
    unsubscribeUrls: (parsed.data.unsubscribeUrls ?? []).filter(isSafeHttpUrl).slice(0, 10),
    raw: content,
  };
}

function isSafeHttpUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    // Try to recover if the model wrapped JSON in code fences.
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}


