import { NextRequest, NextResponse } from "next/server";

/* Server-side proxy for OpenAI Text-to-Speech.
   Keeps OPENAI_API_KEY server-side; streams audio/mpeg to the browser.
   Model: tts-1 (low-latency). Voice configurable via OPENAI_TTS_VOICE (default: nova). */

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  const { text, speed = 1.0 } = await req.json() as { text: string; speed?: number };
  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const voice = process.env.OPENAI_TTS_VOICE ?? "nova"; // nova: warm, natural teaching voice

  const resp = await fetch("https://api.openai.com/v1/audio/speech", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text.slice(0, 4096), // OpenAI TTS max input
      voice,
      speed: Math.min(4.0, Math.max(0.25, speed)), // clamp to API limits
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    console.error("[tts] OpenAI error:", resp.status, err);
    return NextResponse.json({ error: `OpenAI TTS error ${resp.status}` }, { status: resp.status });
  }

  const audio = await resp.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type":        "audio/mpeg",
      "Cache-Control":       "private, max-age=3600",
      "Content-Length":      String(audio.byteLength),
    },
  });
}
