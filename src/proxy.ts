import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Some reverse proxies duplicate single-value request headers. OpenLiteSpeed (the
 * CyberPanel host) forwards the `Origin` header twice, so the app receives
 * "https://site, https://site" — and Next.js throws "Invalid URL" while verifying
 * Server Action origins, surfacing as a 500 on every form post.
 *
 * This collapses such comma-joined values back to the first one before the request
 * reaches the app. It only acts when a comma is present, so it is a no-op behind
 * proxies that behave (nginx, Vercel) and changes nothing for them.
 */
function firstValue(value: string): string {
  const first = value.split(",")[0]!.trim();
  return first || value;
}

export function proxy(request: NextRequest) {
  const singles = ["origin", "x-forwarded-host", "x-forwarded-proto"] as const;
  const mangled = singles.filter((name) => request.headers.get(name)?.includes(","));
  if (mangled.length === 0) return NextResponse.next();

  const headers = new Headers(request.headers);
  for (const name of mangled) headers.set(name, firstValue(request.headers.get(name)!));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Everything except Next's static assets; Server Actions post to normal routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
