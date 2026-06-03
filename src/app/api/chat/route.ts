/**
 * POST /api/chat — Campaign Manager support (app.we-are-glo.com only).
 * Requires OPENAI_API_KEY on the glo-app Vercel project.
 */

import { NextRequest, NextResponse } from "next/server";

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

const SYSTEM_PROMPT = `You are Glo's support assistant inside the Glo Campaign Manager (app.we-are-glo.com) — closed beta for cross-screen local campaigns.

Answer using ONLY these facts. Be concise. If unsure, direct users to sign in, contact support via the site, or email hi@glo.io.

Never invent metrics, features, dates, or guarantees.

## Product
- Upload a Reel or TikTok; Glo remixes it for Connected TV, in-venue TVs, sidewalk DOOH, premium publishers, and geo-fenced mobile.
- Advertisers pick neighborhoods/blocks; Glo matches inventory and optimizes placements.
- Closed beta — "Get started" and "Sign in" are the main actions on the app home.

## Workflow (high level)
- Drop video → pick geo (block/ZIP/city/region/national depending on plan) → campaign goes live quickly (~60 seconds setup; playback can start within the hour).
- Auto-crop: 16:9 for CTV/in-venue, 9:16 phones, 1:1 sidewalk.
- Glo can auto-select screens; dashboard shows spend, plays, and outcomes per screen.

## Pause / billing
- Pause anytime from the dashboard. Charged only on days Glo runs. No long-term contracts on marketing site plans; 7-day money-back mentioned on we-are-glo.com pricing.

## Geos (from public marketing copy)
- Block/ZIP live in NYC (Brooklyn, Queens, Manhattan); Tel Aviv and Austin opening this quarter.
- National CTV and premium publisher inventory across the US.

## Pricing reference (marketing site — may apply to beta users)
- Glo Pilot $29/day, Glo Run $89/day, Glo Reach $249/day. Pause anytime.

## Marketing site (do not claim live in-app features you don't know)
- Full FAQ and demo: https://we-are-glo.com`;

const MAX_MESSAGES = 24;
const MAX_CONTENT_LEN = 2000;

function isAllowedHost(req: NextRequest): boolean {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (host === "app.we-are-glo.com") return true;
  if (process.env.ENABLE_APP_CHAT_LOCAL === "1" && (host === "localhost" || host === "127.0.0.1")) {
    return true;
  }
  if (process.env.VERCEL_ENV === "preview" && host.endsWith(".vercel.app")) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAllowedHost(req)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role as ChatRole,
      content: m.content.trim().slice(0, MAX_CONTENT_LEN),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_MESSAGES);

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    return NextResponse.json({ error: "last message must be from user" }, { status: 400 });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    console.error("OPENAI_API_KEY missing on glo-app");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  try {
    const content = await completeChat(OPENAI_KEY, messages);
    return NextResponse.json({ message: { role: "assistant" as const, content } });
  } catch (e) {
    console.error("chat error", e);
    return NextResponse.json({ error: "chat failed" }, { status: 502 });
  }
}

async function completeChat(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`openai ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("empty assistant reply");
  return content.slice(0, 4000);
}
