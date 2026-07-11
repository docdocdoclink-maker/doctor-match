import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

// Pre-launch gate: while SITE_LOCKED is on (default), only an admin session
// can use the site. Everyone else is bounced to /coming-soon (pages) or gets
// a 503 (API calls). Flip SITE_LOCKED=false in the env for the real launch.
const ALWAYS_ALLOWED = [
  "/",
  "/admin",
  "/api/admin",
  "/coming-soon",
  "/contact",
  "/api/contact",
  "/favicon.ico",
  "/robots.txt",
];

export async function proxy(request) {
  if (process.env.SITE_LOCKED === "false") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getIronSession(request, response, sessionOptions);
  if (session.isAdmin) {
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "現在準備中です。公開までもうしばらくお待ちください。" },
      { status: 503 }
    );
  }

  return NextResponse.redirect(new URL("/coming-soon", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
