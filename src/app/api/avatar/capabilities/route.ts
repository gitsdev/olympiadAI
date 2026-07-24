import { NextResponse } from "next/server";
import type { AvatarCapabilities } from "@/components/tutor/avatar/types";

export async function GET() {
  const caps: AvatarCapabilities = {
    voice: process.env.OPENAI_API_KEY ? "openai" : "browser",
  };
  return NextResponse.json(caps);
}
