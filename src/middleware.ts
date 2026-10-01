import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";

const PUBLIC = [
  "/welcome",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const session = await verifySession(
    req.cookies.get(SESSION_COOKIE)?.value,
  );

  /*
   * The main application now creates an automatic demo session
   * through the app layout, so unauthenticated users are allowed
   * to continue to the application instead of being redirected
   * to the login page.
   */

  if (session && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";

    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();

  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );

  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|ico|webp)$).*)",
  ],
};
