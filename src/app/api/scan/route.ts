import { NextRequest, NextResponse } from "next/server";
import { recordScan } from "@/lib/scans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let code = "JP-FRIDAY10";
  try {
    const body = await req.json();
    if (typeof body?.code === "string") code = body.code;
  } catch { /* default code */ }
  const stats = await recordScan(code);
  return NextResponse.json({ ok: true, ...stats });
}
