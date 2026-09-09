import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/** Every page and API route is behind the shop login except these. */
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const authed = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (authed || isPublic) return NextResponse.next();

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next internals and any file with an extension — branding images and
  // the manifest must stay reachable, not least because Next's image
  // optimizer fetches them server-side without the session cookie.
  matcher: ["/((?!_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
