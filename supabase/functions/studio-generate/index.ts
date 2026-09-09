// Supabase Edge Function: proxy fal.ai queue for Creative Studio generate/remix.
// Auth: verify_jwt ON. Key resolution: env FAL_KEY first, Vault fallback.
import postgres from "npm:postgres@3.4.5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ModelId = "seedance" | "kling" | "veo" | "nano-banana";

type FalRoute = { t2: string; i2: string; kind: "video" | "image" };

/** KEEP IN SYNC with src/lib/studio.ts StudioModels. */
const FAL_ROUTES: Record<ModelId, FalRoute> = {
  seedance: {
    t2: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    i2: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    kind: "video",
  },
  kling: {
    t2: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    i2: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    kind: "video",
  },
  veo: {
    t2: "fal-ai/veo3.1/fast",
    i2: "fal-ai/veo3.1/fast/image-to-video",
    kind: "video",
  },
  "nano-banana": {
    t2: "fal-ai/nano-banana",
    i2: "fal-ai/nano-banana/edit",
    kind: "image",
  },
};

class StudioSecrets {
  static cache = new Map<string, string | null>();

  static async get(name: string): Promise<string | null> {
    if (StudioSecrets.cache.has(name)) return StudioSecrets.cache.get(name) ?? null;
    const envVal = Deno.env.get(name);
    if (envVal) {
      StudioSecrets.cache.set(name, envVal);
      return envVal;
    }
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      StudioSecrets.cache.set(name, null);
      return null;
    }
    const sql = postgres(dbUrl, { max: 1, prepare: false });
    try {
      const rows = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1`;
      const val = (rows[0]?.decrypted_secret as string | undefined) ?? null;
      StudioSecrets.cache.set(name, val);
      return val;
    } catch {
      StudioSecrets.cache.set(name, null);
      return null;
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
}

class FalQueue {
  constructor(private readonly key: string) {}

  async submit(modelId: string, input: Record<string, unknown>): Promise<string> {
    const res = await fetch(`https://queue.fal.run/${modelId}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${this.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = await res.json().catch(() => ({})) as { request_id?: string; detail?: unknown; error?: string };
    if (!res.ok || !body.request_id) {
      throw new Error(FalQueue.errorMessage(body, res.status));
    }
    return body.request_id;
  }

  async status(modelId: string, requestId: string): Promise<{
    status: string;
    error?: string;
    media_url?: string;
    content_type?: string;
  }> {
    const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}/status`, {
      headers: { Authorization: `Key ${this.key}` },
    });
    const statusBody = await statusRes.json().catch(() => ({})) as {
      status?: string;
      error?: string;
      detail?: unknown;
    };
    if (!statusRes.ok) throw new Error(FalQueue.errorMessage(statusBody, statusRes.status));
    const status = statusBody.status ?? "IN_PROGRESS";
    if (status !== "COMPLETED") {
      return { status, error: status === "FAILED" ? (statusBody.error || "Generation failed.") : undefined };
    }

    const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}`, {
      headers: { Authorization: `Key ${this.key}` },
    });
    const result = await resultRes.json().catch(() => ({})) as {
      video?: { url?: string; content_type?: string };
      images?: { url?: string; content_type?: string }[];
      error?: string;
      detail?: unknown;
    };
    if (!resultRes.ok) throw new Error(FalQueue.errorMessage(result, resultRes.status));
    const media = result.video ?? result.images?.[0];
    if (!media?.url) throw new Error("fal.ai returned no media.");
    return {
      status: "COMPLETED",
      media_url: media.url,
      content_type: media.content_type,
    };
  }

  static errorMessage(body: { detail?: unknown; error?: string }, status: number): string {
    if (typeof body.error === "string" && body.error) return body.error;
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
    return `fal.ai request failed (${status})`;
  }
}

class FalPayload {
  static build(model: ModelId, prompt: string, imageUrl?: string): { fal_model: string; input: Record<string, unknown>; kind: "video" | "image" } {
    const route = FAL_ROUTES[model];
    const remix = Boolean(imageUrl);
    const fal_model = remix ? route.i2 : route.t2;
    const input: Record<string, unknown> = { prompt: prompt.trim() };

    if (model === "seedance") {
      input.aspect_ratio = remix ? "auto" : "9:16";
      input.resolution = "720p";
      input.duration = "5";
      if (imageUrl) input.image_url = imageUrl;
    } else if (model === "kling") {
      if (!remix) input.aspect_ratio = "9:16";
      input.duration = "5";
      if (imageUrl) input.image_url = imageUrl;
    } else if (model === "veo") {
      input.aspect_ratio = "9:16";
      input.duration = "8s";
      input.resolution = "720p";
      input.generate_audio = false;
      if (imageUrl) input.image_url = imageUrl;
    } else {
      input.aspect_ratio = "9:16";
      input.output_format = "png";
      input.num_images = 1;
      if (imageUrl) input.image_urls = [imageUrl];
    }

    return { fal_model, input, kind: route.kind };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const falKey = await StudioSecrets.get("FAL_KEY");
    const higgsKey = await StudioSecrets.get("HIGGSFIELD_API_KEY");

    if (req.method === "GET") {
      return json({ fal: Boolean(falKey), higgsfield: Boolean(higgsKey) });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const payload = await req.json().catch(() => ({})) as {
      action?: string;
      model?: string;
      prompt?: string;
      image_url?: string;
      request_id?: string;
      fal_model?: string;
    };

    if (!falKey) {
      return json({
        error: "AI generate is not configured yet. Set FAL_KEY on the studio-generate Edge Function (or in Vault).",
      }, 503);
    }

    const fal = new FalQueue(falKey);

    if (payload.action === "status") {
      if (!payload.request_id || !payload.fal_model) return json({ error: "request_id and fal_model required." }, 400);
      const allowed = Object.values(FAL_ROUTES).flatMap((r) => [r.t2, r.i2]);
      if (!allowed.includes(payload.fal_model)) return json({ error: "Unknown model." }, 400);
      const result = await fal.status(payload.fal_model, payload.request_id);
      const kind = payload.fal_model.includes("nano-banana") ? "image" : "video";
      return json({ ...result, kind });
    }

    if (payload.action !== "submit") return json({ error: "action must be submit or status." }, 400);

    const model = payload.model as ModelId;
    if (!model || !(model in FAL_ROUTES)) return json({ error: "Unknown model." }, 400);
    const prompt = (payload.prompt ?? "").trim();
    if (prompt.length < 3) return json({ error: "Write a prompt (at least a few words)." }, 400);
    if (prompt.length > 2000) return json({ error: "Prompt is too long." }, 400);

    const built = FalPayload.build(model, prompt, payload.image_url);
    const request_id = await fal.submit(built.fal_model, built.input);
    return json({ request_id, fal_model: built.fal_model, model, kind: built.kind });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
