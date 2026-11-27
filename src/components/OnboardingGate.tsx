"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-client";

/** Sends signed-in customers who haven't finished KYC to /onboarding (once per session check).
 *  Signed-out visitors and already-onboarded customers are untouched. */
export function OnboardingGate() {
  const { user, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || pathname?.startsWith("/onboarding")) return;
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    sb.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle().then(({ data, error }) => {
      if (cancelled || error || !data) return;
      if (!data.onboarded_at) {
        const next = `${pathname}${window.location.search}`;
        router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
      }
    });
    return () => { cancelled = true; };
  }, [user, loading, pathname, router]);

  return null;
}
