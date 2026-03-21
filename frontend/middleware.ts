import { NextResponse } from "next/server";

/**
 * DEV MODE: Authentication bypass — all routes are accessible without login.
 * Remove this shortcut before deploying.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
