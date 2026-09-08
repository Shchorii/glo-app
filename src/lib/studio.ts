"use client";

import { getSupabase } from "@/lib/supabase";
import { STUDIO_EMBED_ENDPOINT, STUDIO_GENERATE_ENDPOINT } from "@/lib/endpoints";
import type { Creative } from "@/lib/db";

export const MAX_UPLOAD_MB = 50;

export type StudioModelId = "seedance" | "kling" | "veo" | "nano-banana";

export type StudioModelDef = {
  id: StudioModelId;
  label: string;
  hint: string;
  kind: "video" | "image";
  remix: "image" | "none";
};

export type StudioProviders = {
  fal: boolean;
  higgsfield: boolean;
};

export type GenerateJob = {
  request_id: string;
  fal_model: string;
  model: StudioModelId;
  kind: "video" | "image";
};

export type GenerateStatus = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  error?: string;
  media_url?: string;
  content_type?: string;
  kind?: "video" | "image";
};

/** Street-screen model catalog. IDs must stay in sync with supabase/functions/studio-generate. */
export class StudioModels {
  static list(): StudioModelDef[] {
    return [
      { id: "seedance", label: "Seedance", hint: "ByteDance · 9:16 video, ~5s. Best default remix.", kind: "video", remix: "image" },
      { id: "kling", label: "Kling", hint: "Kling 2.5 Turbo · cinematic motion, 5s portrait.", kind: "video", remix: "image" },
      { id: "veo", label: "Veo", hint: "Google Veo 3.1 Fast · 8s with optional audio off.", kind: "video", remix: "image" },
      { id: "nano-banana", label: "Nano Banana", hint: "Google still · 1080×1920 poster, then remix to video.", kind: "image", remix: "image" },
    ];
  }

  static get(id: StudioModelId): StudioModelDef {
    const found = StudioModels.list().find((m) => m.id === id);
    if (!found) throw new Error(`Unknown model: ${id}`);
    return found;
  }
}

export class StudioMedia {
  static sourceChip(source: Creative["source"]): { label: string; icon: "template" | "upload" | "ai" | "embed" } {
    if (source === "template") return { label: "Template", icon: "template" };
    if (source === "ai") return { label: "AI", icon: "ai" };
    if (source === "embed") return { label: "Embed", icon: "embed" };
    return { label: "Upload", icon: "upload" };
  }

  static isVideoPath(path: string): boolean {
    return /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(path);
  }

  static isImagePath(path: string): boolean {
    return /\.(png|jpe?g|webp|gif)(?:$|\?)/i.test(path);
  }

  static extFromContentType(contentType: string, fallback = "bin"): string {
    const ct = contentType.split(";")[0].trim().toLowerCase();
    if (ct === "video/mp4") return "mp4";
    if (ct === "video/webm") return "webm";
    if (ct === "video/quicktime") return "mov";
    if (ct === "image/png") return "png";
    if (ct === "image/jpeg") return "jpg";
    if (ct === "image/webp") return "webp";
    if (ct === "image/gif") return "gif";
    return fallback;
  }

  static async download(url: string): Promise<{ blob: Blob; ext: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not download result (${res.status}).`);
    const blob = await res.blob();
    const ext = StudioMedia.extFromContentType(blob.type || res.headers.get("content-type") || "", "mp4");
    return { blob, ext };
  }
}

export class FileProbe {
  static async probe(file: File): Promise<{ width?: number; height?: number; duration?: number }> {
    const url = URL.createObjectURL(file);
    try {
      if (file.type.startsWith("video/")) {
        return await new Promise((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () =>
            resolve({ width: v.videoWidth, height: v.videoHeight, duration: Math.round(v.duration) });
          v.onerror = () => resolve({});
          v.src = url;
        });
      }
      if (file.type.startsWith("image/")) {
        return await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve({});
          img.src = url;
        });
      }
      return {};
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  static specWarnings(meta: { width?: number; height?: number; duration?: number }): string[] {
    const w: string[] = [];
    if (meta.width && meta.height && meta.width > meta.height) {
      w.push("This file is landscape. Glo screens are portrait (9:16); it will play with heavy cropping or bars. A 1080×1920 version will look much better.");
    }
    if (meta.width && meta.width < 720) {
      w.push(`Resolution is on the low side (${meta.width}px wide). Street screens are sharp; aim for at least 1080px wide.`);
    }
    if (meta.duration && meta.duration > 30) {
      w.push(`This video runs ${meta.duration}s. Most Glo slots play 15–30s loops; longer files may be trimmed by the venue player.`);
    }
    return w;
  }
}

export class StudioApi {
  static async token(): Promise<string> {
    const sb = getSupabase();
    if (!sb) throw new Error("Studio is not configured in this build.");
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in to use Studio.");
    return token;
  }

  static async providers(): Promise<StudioProviders> {
    if (!STUDIO_GENERATE_ENDPOINT) return { fal: false, higgsfield: false };
    try {
      const token = await StudioApi.token();
      const res = await fetch(STUDIO_GENERATE_ENDPOINT, {
        headers: StudioApi.headers(token),
      });
      const body = (await res.json().catch(() => ({}))) as StudioProviders & { error?: string };
      if (!res.ok) return { fal: false, higgsfield: false };
      return { fal: Boolean(body.fal), higgsfield: Boolean(body.higgsfield) };
    } catch {
      return { fal: false, higgsfield: false };
    }
  }

  static async submitGenerate(input: {
    model: StudioModelId;
    prompt: string;
    image_url?: string;
    name?: string;
  }): Promise<GenerateJob> {
    const body = await StudioApi.post(STUDIO_GENERATE_ENDPOINT, {
      action: "submit",
      model: input.model,
      prompt: input.prompt,
      image_url: input.image_url,
      name: input.name,
    });
    if (!body.request_id || !body.fal_model) {
      throw new Error(typeof body.error === "string" ? body.error : "Generate did not start.");
    }
    return {
      request_id: String(body.request_id),
      fal_model: String(body.fal_model),
      model: input.model,
      kind: body.kind === "image" ? "image" : "video",
    };
  }

  static async pollGenerate(job: GenerateJob): Promise<GenerateStatus> {
    const body = await StudioApi.post(STUDIO_GENERATE_ENDPOINT, {
      action: "status",
      request_id: job.request_id,
      fal_model: job.fal_model,
    });
    const status = body.status === "IN_QUEUE" || body.status === "IN_PROGRESS" || body.status === "COMPLETED" || body.status === "FAILED"
      ? body.status
      : "IN_PROGRESS";
    return {
      status,
      error: typeof body.error === "string" ? body.error : undefined,
      media_url: typeof body.media_url === "string" ? body.media_url : undefined,
      content_type: typeof body.content_type === "string" ? body.content_type : undefined,
      kind: body.kind === "image" || body.kind === "video" ? body.kind : undefined,
    };
  }

  static async embed(url: string, name?: string): Promise<{ creative: Creative; note?: string }> {
    const body = await StudioApi.post(STUDIO_EMBED_ENDPOINT, { url, name });
    const creative = body.creative as Creative | undefined;
    if (!creative?.id) throw new Error((body.error as string) || "Could not ingest that URL.");
    return { creative, note: body.note as string | undefined };
  }

  private static headers(token: string): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    };
  }

  private static async post(endpoint: string | null, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!endpoint) throw new Error("Studio is not configured in this build.");
    const token = await StudioApi.token();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: StudioApi.headers(token),
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error((body.error as string) || `Request failed (${res.status})`);
    return body;
  }
}
