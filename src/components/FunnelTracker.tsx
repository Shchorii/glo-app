"use client";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { captureFunnelParams, funnel, setFunnelEmail } from "@/lib/funnel";

/** Ties the signed-in user to their website visitor ID and logs account creation / return visits. */
export function FunnelTracker() {
  const { user } = useSession();
  useEffect(() => { captureFunnelParams(); }, []);
  useEffect(() => {
    if (!user) return;
    setFunnelEmail(user.email);
    const provider = String(user.app_metadata?.provider || "email");
    const ageMin = (Date.now() - new Date(user.created_at).getTime()) / 60000;
    if (ageMin < 60) funnel("account_created", provider, `forever:acct_${user.id}`);
    else funnel("app_login", provider, `forever:login_${user.id}_${new Date().toISOString().slice(0, 10)}`);
  }, [user]);
  return null;
}
