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

  /* HeyGen / LiveAvatar — create a session token.
     The SDK (api.liveavatar.com) uses this token as a Bearer JWT.
     Endpoint: POST https://api.liveavatar.com/v1/sessions/token  (x-api-key auth) */
  const body: Record<string, unknown> = { avatar_id: avatarId };
  if (voiceId) body.voice_id = voiceId;

  const resp = await fetch("https://api.liveavatar.com/v1/sessions/token", {
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

  const data = await resp.json() as Record<string, unknown>;
  console.log("[heygen-token] raw response:", JSON.stringify(data));

  /* HeyGen Live Avatar API returns the token at one of these paths */
  const inner = data?.data as Record<string, unknown> | undefined;
  const token =
    (inner?.session_token as string | undefined) ??
    (inner?.token         as string | undefined) ??
    (data?.token          as string | undefined) ??
    (data?.session_token  as string | undefined);

  if (!token) {
    console.error("[heygen-token] could not find token in response. Full response:", JSON.stringify(data));
    return NextResponse.json(
      { error: "No token in HeyGen response", response: data },
      { status: 500 },
    );
  }

  return NextResponse.json({ token });
}
