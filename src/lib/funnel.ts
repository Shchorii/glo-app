"use client";
// Funnel stage beacons -> we-are-glo.com/api/intent -> Airtable "Funnel Events" + "Signups".
// The marketing site hands over its visitor ID (?gvid=) and source (?gsrc=) on every
// link into the app, so one person is one row from first ad click to repeat booking.
// Best-effort only: never throws, never blocks the UI.

const ENDPOINT = "https://we-are-glo.com/api/intent";
const VID_KEY = "glo_vid";
const SRC_KEY = "glo_src";

function ls(k: string): string {
  try { return localStorage.getItem(k) || ""; } catch { return ""; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}

/** Read gvid/gsrc (or plain utm_*) from the landing URL. Call once per page load. */
export function captureFunnelParams(): void {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  const v = q.get("gvid");
  if (v) lsSet(VID_KEY, v.slice(0, 40));
  const s = q.get("gsrc");
  if (s && !ls(SRC_KEY)) lsSet(SRC_KEY, s.slice(0, 200));
  if (!ls(SRC_KEY) && q.get("utm_source")) {
    lsSet(SRC_KEY, [q.get("utm_campaign") || "organic", `src:${q.get("utm_source")}`, q.get("utm_medium") && `med:${q.get("utm_medium")}`]
      .filter(Boolean).join("|").slice(0, 200));
  }
}

function visitorId(): string {
  let v = ls(VID_KEY);
  if (!v) {
    v = (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`).slice(0, 36);
    lsSet(VID_KEY, v);
  }
  return v;
}

let email = "";
let uid = "";
export function setFunnelUser(e: string | null | undefined, id?: string | null) { email = (e || "").trim().toLowerCase(); uid = id || ""; }

/**
 * Send a funnel event.
 * once: "forever:<key>" dedupes on this device for good, "session:<key>" per browser tab session.
 */
export function funnel(event: string, detail = "", once = ""): void {
  if (typeof window === "undefined") return;
  if (once) {
    const [scope, ...rest] = once.split(":");
    const key = `glo_f_${rest.join(":")}`;
    try {
      const store = scope === "session" ? sessionStorage : localStorage;
      if (store.getItem(key)) return;
      store.setItem(key, "1");
    } catch { /* ignore */ }
  }
  try {
    const body = JSON.stringify({
      event,
      detail: String(detail).slice(0, 120),
      vid: visitorId(),
      email,
      uid,
      campaign_id: ls(SRC_KEY) || "organic|src:app",
      url: window.location.href,
      referrer: document.referrer,
    });
    // text/plain keeps this a "simple" cross-origin request (no preflight).
    const blob = new Blob([body], { type: "text/plain" });
    if (!navigator.sendBeacon?.(ENDPOINT, blob)) {
      fetch(ENDPOINT, { method: "POST", body, keepalive: true, mode: "no-cors" }).catch(() => {});
    }
  } catch { /* best-effort */ }
}
