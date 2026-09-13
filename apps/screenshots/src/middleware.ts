import { NextResponse, type NextRequest } from "next/server";

// The API writes the git-tracked deck and files under public/. A page on any
// other site can POST text/plain here without a preflight, so writes must be
// JSON (which forces one) and must not be flagged cross-site by the browser.
export function middleware(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return NextResponse.next();
  const json = req.headers.get("content-type")?.startsWith("application/json") ?? false;
  const site = req.headers.get("sec-fetch-site");
  if (!json || (site !== null && site !== "same-origin")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
