"use client";
// Launch offer from we-are-glo.com/offer: $10 of Glo credit on every full $100.
// The offer link carries ?promo=10on100; we keep it on this device until the person has an
// account, then store it on the account (user metadata). Checkout applies it server-side.
export const PROMO = "10on100";
const KEY = "glo_promo";

/** $10 for every full $100. KEEP IN SYNC with supabase/functions/checkout. */
export function promoCredit(total: number): number {
  return Math.floor(total / 100) * 10;
}

export function rememberPromoFromUrl(): void {
  if (typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("promo") === PROMO) {
    try { localStorage.setItem(KEY, PROMO); } catch { /* ignore */ }
  }
}

export function storedPromo(): string {
  try { return localStorage.getItem(KEY) === PROMO ? PROMO : ""; } catch { return ""; }
}
