import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get("imo-auth")?.value;
  const password = process.env.AUTH_PASSWORD;

  if (!password) return NextResponse.next();

  if (authCookie === password) return NextResponse.next();

  if (request.nextUrl.pathname === "/login") return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
