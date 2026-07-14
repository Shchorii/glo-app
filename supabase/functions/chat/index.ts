// Supabase Edge Function: GloBot support chat (replaces Next /api/chat).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) throw new Error("bad payload");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages.slice(-12)],
        temperature: 0.4,
        max_tokens: 700,
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = await res.json();
    const reply = (data.choices?.[0]?.message?.content ?? "").trim().slice(0, 4000);
    return new Response(JSON.stringify({ reply }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
