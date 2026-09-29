import { NextResponse, type NextRequest } from "next/server";
import { optOutByToken } from "@/lib/email/unsubscribe";

/**
 * RFC 8058 one-click unsubscribe target for the List-Unsubscribe header.
 * Mail clients (Gmail's "Unsubscribe" button) POST here with no user
 * interaction. Deliberately POST-only: link scanners prefetch GETs, which
 * would silently unsubscribe people — the human-facing link in the email
 * body goes to the /unsubscribe confirmation page instead.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  await optOutByToken(token);
  // Always 200 so an invalid/old token doesn't make clients retry.
  return new NextResponse(null, { status: 200 });
}
