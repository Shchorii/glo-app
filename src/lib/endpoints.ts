// Edge Function endpoints. Derived from the Supabase URL when configured.
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const CHAT_ENDPOINT = base ? `${base}/functions/v1/chat` : null;
export const SCAN_ENDPOINT = base ? `${base}/functions/v1/scan` : null;
export const CHECKOUT_ENDPOINT = base ? `${base}/functions/v1/checkout` : null;
