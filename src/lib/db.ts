"use client";
import { getSupabase } from "@/lib/supabase";
import { CHECKOUT_ENDPOINT } from "@/lib/endpoints";

export type Screen = {
  id: string;
  publisher_id: string;
  name: string;
  venue_type: string;
  city: string;
  lat: number;
  lng: number;
  daily_price_usd: number;
  width_px: number;
  height_px: number;
  max_duration_s: number;
  is_available: boolean;
};

export type CampaignStatus =
  | "draft" | "pending_payment" | "pending_review" | "scheduled"
  | "live" | "completed" | "cancelled" | "refunded";

export type Campaign = {
  id: string;
  user_id: string;
  creative_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  total_usd: number;
  status: CampaignStatus;
  dayparts: string[];
  created_at: string;
  screen_count?: number;
};

export type CampaignDetail = Campaign & {
  screens: Screen[];
  creative: Creative | null;
};

export type Creative = {
  id: string;
  user_id: string;
  storage_path: string;
  source: "upload" | "template";
  width_px: number | null;
  height_px: number | null;
  duration_s: number | null;
  review_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};

function sb() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase is not configured in this build.");
  return c;
}

export async function listScreens(): Promise<Screen[]> {
  const { data, error } = await sb()
    .from("screens")
    .select("*")
    .eq("is_available", true)
    .order("city")
    .order("daily_price_usd");
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, daily_price_usd: Number(s.daily_price_usd) })) as Screen[];
}

export async function listMyCampaigns(): Promise<Campaign[]> {
  const { data, error } = await sb()
    .from("campaigns")
    .select("*, campaign_screens(screen_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    ...c,
    total_usd: Number(c.total_usd),
    screen_count: (c.campaign_screens as { screen_id: string }[] | null)?.length ?? 0,
  })) as Campaign[];
}

export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  const { data, error } = await sb()
    .from("campaigns")
    .select("*, campaign_screens(screens(*)), creatives(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const screens = ((data.campaign_screens as { screens: Screen }[] | null) ?? [])
    .map((cs) => cs.screens)
    .filter(Boolean)
    .map((s) => ({ ...s, daily_price_usd: Number(s.daily_price_usd) }));
  return {
    ...(data as unknown as Campaign),
    total_usd: Number(data.total_usd),
    screens,
    creative: (data.creatives as Creative | null) ?? null,
  };
}

export type NewCampaign = {
  name: string;
  start_date: string; // yyyy-mm-dd
  end_date: string;
  screen_ids: string[];
  creative_id: string | null;
  total_usd: number;
  dayparts: string[];
  status: Extract<CampaignStatus, "draft" | "pending_payment">;
};

export async function createCampaign(input: NewCampaign): Promise<string> {
  const client = sb();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to book screens.");

  const { data, error } = await client
    .from("campaigns")
    .insert({
      user_id: uid,
      name: input.name,
      start_date: input.start_date,
      end_date: input.end_date,
      creative_id: input.creative_id,
      total_usd: input.total_usd,
      dayparts: input.dayparts.length ? input.dayparts : ["all_day"],
      status: input.status,
    })
    .select("id")
    .single();
  if (error) throw error;
  const campaignId = data.id as string;

  const links = input.screen_ids.map((screen_id) => ({ campaign_id: campaignId, screen_id }));
  const { error: linkErr } = await client.from("campaign_screens").insert(links);
  if (linkErr) throw linkErr;
  return campaignId;
}

/** Cancel is an owner-side status update; RLS permits updates only while draft. */
export async function cancelDraft(id: string): Promise<void> {
  const { data, error } = await sb()
    .from("campaigns")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Draft could not be cancelled. Refresh and try again.");
}

export async function uploadCreative(
  blob: Blob,
  opts: { source: "upload" | "template"; ext: string; width?: number; height?: number; duration?: number }
): Promise<Creative> {
  const client = sb();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in to upload creatives.");

  const path = `${uid}/${crypto.randomUUID()}.${opts.ext}`;
  const { error: upErr } = await client.storage.from("creatives").upload(path, blob, {
    contentType: blob.type || undefined,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await client
    .from("creatives")
    .insert({
      user_id: uid,
      storage_path: path,
      source: opts.source,
      width_px: opts.width ?? null,
      height_px: opts.height ?? null,
      duration_s: opts.duration ?? null,
    })
    .select("*")
    .single();
  if (error) {
    const { error: cleanupError } = await client.storage.from("creatives").remove([path]);
    if (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Creative metadata could not be saved, and the uploaded file could not be removed."
      );
    }
    throw error;
  }
  return data as Creative;
}

export async function signedCreativeUrl(path: string): Promise<string> {
  const { data, error } = await sb().storage.from("creatives").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Kicks off Stripe Checkout for a reserved campaign; resolves to the redirect URL. */
export async function startCheckout(campaignId: string): Promise<string> {
  if (!CHECKOUT_ENDPOINT) throw new Error("Checkout is not configured in this build.");
  const client = sb();
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to pay.");
  const res = await fetch(CHECKOUT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    },
    body: JSON.stringify({ campaign_id: campaignId }),
  });
  let body: { url?: string; error?: string };
  try {
    body = await res.json();
  } catch (error) {
    throw new Error(
      res.ok ? "Checkout returned an invalid response." : `Checkout failed (${res.status})`,
      { cause: error }
    );
  }
  if (!res.ok || !body.url) throw new Error(body.error || `Checkout failed (${res.status})`);
  return body.url;
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86400000) + 1; // inclusive flight
}

export const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
