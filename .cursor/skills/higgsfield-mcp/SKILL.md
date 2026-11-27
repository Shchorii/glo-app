---
name: higgsfield-mcp
description: Use Higgsfield MCP to generate images and videos for Glo agents. Not a Studio form — do not add hub cards or /studio routes for Higgsfield.
---

# Higgsfield MCP (agent connector)

Glo Studio talks to **fal.ai** for in-app generate/remix. Higgsfield is an **agent connector only**.

- MCP server: `https://mcp.higgsfield.ai/mcp`
- Project config: `.cursor/mcp.json` (Cursor). Claude: Settings → Connectors → that URL. Claude Code: `npm i -g @higgsfield/cli` then `higgsfield auth login`.
- Auth is OAuth against a Higgsfield account. Do **not** put `HIGGSFIELD_API_KEY` in the static client or invent a second Studio form.
- `HIGGSFIELD_API_KEY` / `HIGGSFIELD_API_SECRET` stay optional Edge/Vault secrets for a future REST path.

## When to use

Call Higgsfield tools when the user (or an agent) wants extra models (Soul, Cinema Studio, Flux, etc.) outside the Studio hub. Street screens are **portrait 9:16 / 1080×1920**. Ask before spending credits.

## When not to use

- Do not add a Higgsfield card, generate form, or ingest route to Creative Studio.
- In-app Studio generate stays on fal.ai (`studio-generate` + `FAL_KEY`).
- Results land in Higgsfield Assets, not the Glo `creatives` library, unless the user explicitly asks to import a file.
