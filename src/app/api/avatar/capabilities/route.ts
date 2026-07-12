import { NextResponse } from "next/server";
import type { AvatarCapabilities } from "@/components/tutor/avatar/types";

/* Returns which avatar/voice providers are available for this deployment.
   Never exposes API keys — only announces what's configured. */
export async function GET() {
  const caps: AvatarCapabilities = {
    video:    process.env.HEYGEN_API_KEY   ? "heygen" : "none",
    voice:    process.env.OPENAI_API_KEY   ? "openai" : "browser",
    avatarId: process.env.HEYGEN_AVATAR_ID ?? "Ann_Therapist_public",
    voiceId:  process.env.HEYGEN_VOICE_ID  ?? "2d5b0e6cf36f460aa7fc47e3eee4ba54",
  };
  return NextResponse.json(caps);
}
