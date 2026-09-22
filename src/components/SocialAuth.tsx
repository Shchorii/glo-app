"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Provider = "google" | "apple" | "azure";

const LABELS: Record<Provider, string> = { google: "Google", apple: "Apple", azure: "Microsoft" };

const ICONS: Record<Provider, React.ReactNode> = {
  google: (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  ),
  apple: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.59-.75 2.99-.75 1.4 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.45-3.71zM14.09 5.87c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.1 1.77-.97 2.82 1.03.08 2.07-.52 2.71-1.28z"/>
    </svg>
  ),
  azure: (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M12 1h10v10H12z"/>
      <path fill="#00A4EF" d="M1 12h10v10H1z"/><path fill="#FFB900" d="M12 12h10v10H12z"/>
    </svg>
  ),
};

declare global {
  interface Window { ReactNativeWebView?: { postMessage: (msg: string) => void } }
}

/** Google / Apple / Microsoft buttons. Only providers enabled in Supabase are shown,
 *  so this renders nothing until a provider is switched on. Works for sign-in AND
 *  sign-up (first SSO sign-in creates the account). Inside the Glo native app the
 *  flow is handed to the system browser, because Google blocks embedded web views. */
export function SocialAuth({ next = "/studio", mode = "in" }: { next?: string; mode?: "in" | "up" }) {
  const [enabled, setEnabled] = useState<Provider[]>([]);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((s) => {
        const ext = (s?.external ?? {}) as Record<string, boolean>;
        setEnabled((["google", "apple", "azure"] as Provider[]).filter((p) => ext[p]));
      })
      .catch(() => {});
  }, []);

  async function go(provider: Provider) {
    setError(null);
    setBusy(provider);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "oauth", provider, next }));
      setTimeout(() => setBusy(null), 1500);
      return;
    }
    const sb = getSupabase();
    if (!sb) { setBusy(null); setError("Sign-in is not configured in this build."); return; }
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${next}`, scopes: provider === "azure" ? "email" : undefined },
    });
    if (error) { setBusy(null); setError(error.message); }
  }

  if (enabled.length === 0) return null;
  const verb = mode === "up" ? "Sign up" : "Continue";

  return (
    <div className="space-y-2.5">
      {enabled.map((p) => (
        <button key={p} type="button" onClick={() => go(p)} disabled={busy !== null}
          className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 text-sm font-medium hover:border-ink-400 transition disabled:opacity-50">
          {ICONS[p]}
          {busy === p ? "Opening..." : `${verb} with ${LABELS[p]}`}
        </button>
      ))}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-3 pt-2 pb-1">
        <div className="h-px flex-1 bg-line-800" />
        <span className="text-xs uppercase tracking-wider text-ink-500">or with email</span>
        <div className="h-px flex-1 bg-line-800" />
      </div>
    </div>
  );
}
