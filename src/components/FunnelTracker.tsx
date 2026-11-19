"use client";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { captureFunnelParams, funnel, setFunnelUser } from "@/lib/funnel";
import { PROMO, rememberPromoFromUrl, storedPromo } from "@/lib/promo";
import { getSupabase } from "@/lib/supabase";
import { GOOGLE_ADS_ID, GOOGLE_ADS_SIGNUP_LABEL } from "@/components/Analytics";

/** Google Ads sign-up conversion, once per account per browser. */
function googleAdsSignup(userId: string) {
  try {
    const key = `aw_signup_${userId}`;
    if (localStorage.getItem(key)) return;
    // Queue through dataLayer if gtag.js hasn't loaded yet; it replays the queue on load.
    const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
    w.dataLayer = w.dataLayer || [];
    if (typeof w.gtag !== "function") w.gtag = function () { w.dataLayer!.push(arguments); };
    w.gtag("event", "conversion", { send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_SIGNUP_LABEL}`, transaction_id: userId });
    localStorage.setItem(key, "1");
  } catch {}
}

/** Ties the signed-in user to their website visitor ID and logs account creation / return visits. */
export function FunnelTracker() {
  const { user } = useSession();
  useEffect(() => { captureFunnelParams(); rememberPromoFromUrl(); }, []);
  useEffect(() => {
    if (!user) return;
    setFunnelUser(user.email, user.id);
    // Offer link -> keep the launch credit on the account (covers Google sign-up too).
    if (storedPromo() && user.user_metadata?.promo !== PROMO) {
      getSupabase()?.auth.updateUser({ data: { promo: PROMO, promo_at: new Date().toISOString() } })
        .then(() => funnel("promo_claimed", PROMO, `forever:promo_${user.id}`)).catch(() => {});
    }
    const provider = String(user.app_metadata?.provider || "email");
    const ageMin = (Date.now() - new Date(user.created_at).getTime()) / 60000;
    if (ageMin < 60) { funnel("account_created", provider, `forever:acct_${user.id}`); googleAdsSignup(user.id); }
    else funnel("app_login", provider, `forever:login_${user.id}_${new Date().toISOString().slice(0, 10)}`);
  }, [user]);
  return null;
}
