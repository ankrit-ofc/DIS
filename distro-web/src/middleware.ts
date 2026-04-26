import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("distro-token")?.value;
  const role = request.cookies.get("distro-role")?.value;

  // Admin routes — ADMIN only
  if (pathname.startsWith("/admin")) {
    if (!token || role !== "ADMIN") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Driver dashboard — DRIVER only. /driver/login is public.
  if (pathname === "/driver" || (pathname.startsWith("/driver/") && pathname !== "/driver/login")) {
    if (!token || role !== "DRIVER") {
      const url = request.nextUrl.clone();
      url.pathname = "/driver/login";
      return NextResponse.redirect(url);
    }
  }

  // Buyer-authenticated routes
  if (pathname.startsWith("/orders") || pathname === "/account") {
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/orders/:path*", "/account", "/driver", "/driver/:path*"],
};
