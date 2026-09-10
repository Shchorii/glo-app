# glo-app

Glo Campaign Manager — agentic AI creative studio + neighborhood ad campaign builder.

**Live:** [app.we-are-glo.com](https://app.we-are-glo.com)

## Modules

- **M1 — Creative Studio** *(in progress)* — Upload/embed videos (TikTok, YouTube, public Instagram, direct MP4), AI-remix via fal.ai (Seedance, Kling, Veo, Nano Banana). Higgsfield MCP is an agent connector (`.cursor/mcp.json` → [mcp.higgsfield.ai/mcp](https://mcp.higgsfield.ai/mcp)), not a second Studio form.
- **M2 — Campaign Builder** *(next)* — Block-level neighborhood targeting, multi-surface delivery, scheduling, bidding
- **M3 — Dashboard** *(next)* — Cross-surface engagement, geo-heatmap by block

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Cloudflare Stream · fal.ai · Supabase (auth+DB+storage) · Vercel

## Studio secrets (never in the static client)

Set these as **Supabase Edge Function secrets** or **Vault** names. Values do not belong in git or `NEXT_PUBLIC_*`.

| Secret | Where | Required? |
| --- | --- | --- |
| `FAL_KEY` | `studio-generate` | Yes, for in-app generate/remix |
| `META_OEMBED_TOKEN` | `studio-embed` | No. Instagram oEmbed is tokenless as of 2026-06-15; a Meta user/app token raises Graph rate limits. If Graph asks for a token, the function returns 503 with this name — same pattern as missing `FAL_KEY`. |
| `MODERATION_WEBHOOK_URL` | `studio-ingest-notify` (+ Vault) | No. If missing, ingest still succeeds and the webhook is skipped (logged once). |
| `MODERATION_WEBHOOK_KEY` | `studio-ingest-notify` (+ Vault) | No. Bearer + `X-Automation-Key` for the Glo Moderation `studio-ingest-moderate` routine. |
| `HIGGSFIELD_API_KEY` / `HIGGSFIELD_API_SECRET` | reserved | No. Agents use Higgsfield MCP OAuth, not these keys. |

Redeploy `studio-embed` after this lands so Instagram ingest uses Graph oEmbed.

### Higgsfield for agents

1. Cursor: project already lists the server in `.cursor/mcp.json`. Sign in via OAuth on first use (or add Higgsfield from the Cursor marketplace).
2. Claude: Settings → Connectors → `https://mcp.higgsfield.ai/mcp`.
3. Claude Code: `npm i -g @higgsfield/cli` then `higgsfield auth login`.

Do not add a Higgsfield card or form to `/studio`. In-app generate stays on fal.ai. Agent skill: `.cursor/skills/higgsfield-mcp/SKILL.md`.
