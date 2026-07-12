import { NextResponse } from "next/server";

/* Server-side proxy for HeyGen Live Avatar session token.
   Keeps HEYGEN_API_KEY secret — never exposed to the browser.

   HeyGen Live Avatar API docs: https://docs.liveavatar.com
   Token endpoint: POST https://api.heygen.com/v1/live_avatar.session.new
*/

export async function GET() {
  const apiKey   = process.env.HEYGEN_API_KEY;
  const avatarId = process.env.HEYGEN_AVATAR_ID ?? "Ann_Therapist_public";
  const voiceId  = process.env.HEYGEN_VOICE_ID;

  if (!apiKey) {
    return NextResponse.json(
      { error: "HEYGEN_API_KEY is not configured" },
      { status: 503 },
    );
  }

  /* HeyGen Live Avatar — create a new session and get a session token.
     The token is a short-lived JWT passed to LiveAvatarSession() on the client. */
  const body: Record<string, unknown> = { avatar_id: avatarId };
  if (voiceId) body.voice_id = voiceId;

  const resp = await fetch("https://api.heygen.com/v1/live_avatar.session.new", {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("[heygen-token] API error:", resp.status, text);
    return NextResponse.json(
      { error: `HeyGen API error ${resp.status}` },
      { status: resp.status },
    );
  }

  const data = await resp.json() as { data?: { session_token?: string }; token?: string };

  /* Different HeyGen API versions may return the token under different keys */
  const token = data?.data?.session_token ?? (data as { token?: string })?.token;
  if (!token) {
    return NextResponse.json({ error: "No token in HeyGen response" }, { status: 500 });
  }

  return NextResponse.json({ token });
}
