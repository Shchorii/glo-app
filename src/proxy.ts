import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/studio", "/library", "/campaigns", "/dashboard", "/settings"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Check session cookie (better-auth sets `better-auth.session_token`)
  const session = req.cookies.get("better-auth.session_token");
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/studio/:path*", "/library/:path*", "/campaigns/:path*", "/dashboard/:path*", "/settings/:path*"],
};
