import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "amber_session";

/**
 * Sends visitors without a session cookie to the login page before any
 * members-only page starts rendering, so they get a real HTTP redirect.
 *
 * This is only a convenience: it checks that a cookie is present, not that it
 * is valid. Every page, Server Action and Route Handler verifies the session
 * and the user's role itself.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/cart",
    "/checkout/:path*",
    "/instructor/:path*",
    "/my-learning/:path*",
    "/notifications",
    "/wishlist",
  ],
};
