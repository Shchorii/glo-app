import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

async function sign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!adminEmail || !adminPassword || !secret) {
    return NextResponse.json({ error: "Owner auth not configured" }, { status: 500 });
  }
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ts = Date.now().toString();
  const payload = `${email}:${ts}`;
  const sig = await sign(payload, secret);
  const cookieValue = `${btoa(payload).replace(/=+$/, "")}.${sig}`;
  const res = NextResponse.json({ ok: true });
  res.cookies.set("glo-owner", cookieValue, {
    httpOnly: true, secure: true, sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  return res;
}
