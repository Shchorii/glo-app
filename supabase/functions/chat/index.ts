// Supabase Edge Function: GloBot support chat.
// API key resolution: Supabase Vault ('OPENAI_API_KEY') first, env secret as fallback.
import postgres from "npm:postgres@3.4.5";

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedKey: string | null = null;

async function getOpenAIKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (dbUrl) {
    const sql = postgres(dbUrl, { max: 1, prepare: false });
    try {
      const rows = await sql`select decrypted_secret from vault.decrypted_secrets where name = 'OPENAI_API_KEY' limit 1`;
      const key = rows[0]?.decrypted_secret as string | undefined;
      if (key) { cachedKey = key; return key; }
    } catch (error) {
      console.warn("OpenAI key lookup in Vault failed; trying environment fallback.", error);
    } finally {
      try {
        await sql.end({ timeout: 2 });
      } catch (error) {
        console.warn("Vault connection cleanup failed.", error);
      }
    }
  }
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey) { cachedKey = envKey; return envKey; }
  throw new Error("no key source");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
  const messages =
    typeof body === "object" && body !== null && "messages" in body
      ? (body as { messages?: unknown }).messages
      : null;
  if (!Array.isArray(messages)) return json({ error: "messages must be an array." }, 400);

  let apiKey: string;
  try {
    apiKey = await getOpenAIKey();
  } catch (error) {
    console.error("OpenAI key resolution failed.", error);
    return json({ error: "Support chat is temporarily unavailable." }, 503);
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages.slice(-12)],
        temperature: 0.4,
        max_tokens: 700,
      }),
    });
    if (!res.ok) {
      console.error(`OpenAI request failed with status ${res.status}.`);
      return json({ error: "Support chat could not generate a reply." }, 502);
    }
    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = (data.choices?.[0]?.message?.content ?? "").trim().slice(0, 4000);
    if (!reply) {
      console.error("OpenAI returned an empty support chat reply.");
      return json({ error: "Support chat returned an empty reply." }, 502);
    }
    return json({ reply, message: { role: "assistant", content: reply } });
  } catch (error) {
    console.error("OpenAI request failed.", error);
    return json({ error: "Support chat could not be reached." }, 502);
  }
});
