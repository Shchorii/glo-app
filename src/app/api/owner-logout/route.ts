import { NextResponse } from "next/server";
export const runtime = "edge";
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("glo-owner", "", { maxAge: 0, path: "/" });
  return res;
}
