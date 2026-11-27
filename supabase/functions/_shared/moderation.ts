// Glo Moderation ingest: Vault/env secrets, one-shot POST, never throws to the caller.
import postgres from "npm:postgres@3.4.5";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const SIGNED_TTL_S = 600;
const POST_TIMEOUT_MS = 8000;
const secretCache = new Map<string, string | null>();
let missingSecretsLogged = false;

async function getSecret(name: string): Promise<string | null> {
  if (secretCache.has(name)) return secretCache.get(name) ?? null;
  const envVal = Deno.env.get(name);
  if (envVal) {
    secretCache.set(name, envVal);
    return envVal;
  }
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    secretCache.set(name, null);
    return null;
  }
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const rows = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1`;
    const val = (rows[0]?.decrypted_secret as string | undefined) ?? null;
    secretCache.set(name, val);
    return val;
  } catch {
    secretCache.set(name, null);
    return null;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

export function contentTypeFromPath(path: string, fallback = "application/octet-stream"): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov" || ext === "m4v") return "video/quicktime";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return fallback;
}

export type ModerationCreative = {
  id: string;
  user_id: string;
  source: string;
  storage_path: string;
  width_px?: number | null;
  height_px?: number | null;
  duration_s?: number | null;
  source_url?: string | null;
  created_at: string;
};

/** Best-effort POST to Glo Moderation. Missing secrets or network errors are logged, never thrown. */
export async function notifyModerationIngest(
  admin: SupabaseClient,
  creative: ModerationCreative,
  contentType?: string | null,
): Promise<void> {
  try {
    const url = await getSecret("MODERATION_WEBHOOK_URL");
    const key = await getSecret("MODERATION_WEBHOOK_KEY");
    if (!url || !key) {
      if (!missingSecretsLogged) {
        console.warn("moderation webhook skipped: MODERATION_WEBHOOK_URL or MODERATION_WEBHOOK_KEY is not set");
        missingSecretsLogged = true;
      }
      return;
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("creatives")
      .createSignedUrl(creative.storage_path, SIGNED_TTL_S);
    if (signErr || !signed?.signedUrl) {
      console.error("moderation webhook skipped: could not sign creative", signErr?.message ?? "");
      return;
    }

    const payload: Record<string, unknown> = {
      creative_id: creative.id,
      user_id: creative.user_id,
      source: creative.source,
      storage_path: creative.storage_path,
      content_type: (contentType && contentType.length > 0) ? contentType : contentTypeFromPath(creative.storage_path),
      width: creative.width_px ?? null,
      height: creative.height_px ?? null,
      duration_s: creative.duration_s ?? null,
      signed_url: signed.signedUrl,
      created_at: creative.created_at,
    };
    if (creative.source_url) payload.source_url = creative.source_url;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "X-Automation-Key": key,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`moderation webhook failed: ${res.status} ${body}`.slice(0, 300));
    }
  } catch (e) {
    console.error("moderation webhook failed:", e instanceof Error ? e.message : String(e));
  }
}
