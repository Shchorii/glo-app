import { getSupabase } from "@/lib/supabase";
import { STUDIO_INGEST_NOTIFY_ENDPOINT } from "@/lib/endpoints";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type CampaignStatusForAttach =
  | "draft" | "pending_payment" | "pending_review" | "scheduled"
  | "live" | "completed" | "cancelled" | "refunded";

const PAID_LIVE: CampaignStatusForAttach[] = ["pending_review", "scheduled", "live"];

export function isPaidLiveStatus(status: CampaignStatusForAttach): boolean {
  return PAID_LIVE.includes(status);
}

/** Null if the creative may attach to a campaign in this status. */
export function creativeAttachError(
  creative: { review_status: ReviewStatus; rejection_reason: string | null },
  campaignStatus: CampaignStatusForAttach,
): string | null {
  if (creative.review_status === "approved") return null;
  if (creative.review_status === "rejected") {
    const reason = creative.rejection_reason?.trim();
    return reason
      ? `This creative was rejected: ${reason}`
      : "This creative was rejected and cannot attach to a campaign.";
  }
  if (isPaidLiveStatus(campaignStatus)) {
    return "This creative is still in review. It can attach to a paid campaign once approved.";
  }
  return null;
}

/** Fire-and-forget: never throws, never blocks the insert that just succeeded. */
export function pingModerationIngest(creativeId: string, contentType?: string): void {
  const endpoint = STUDIO_INGEST_NOTIFY_ENDPOINT;
  if (!endpoint) return;
  const client = getSupabase();
  if (!client) return;
  void client.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token;
    if (!token) return;
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({ creative_id: creativeId, content_type: contentType }),
      keepalive: true,
    });
  }).catch(() => {});
}
