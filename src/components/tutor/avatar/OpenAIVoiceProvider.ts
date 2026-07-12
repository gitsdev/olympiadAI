import type { AvatarProvider } from "./types";

/* OpenAI TTS provider — natural AI voice, no video.
   Proxies through /api/avatar/tts to keep OPENAI_API_KEY server-side.
   Voice "nova" is warm and natural for teaching; override with OPENAI_TTS_VOICE. */

export class OpenAIVoiceProvider implements AvatarProvider {
  readonly id          = "openai-voice";
  readonly displayName = "OpenAI Natural Voice";
  readonly hasVideo    = false;

  private audio:   HTMLAudioElement | null = null;
  private abortCtl: AbortController | null = null;
  private onEndCurrent: (() => void) | null = null;
  private paused  = false;

  async initialize(): Promise<void> {
    // No setup needed — TTS is fetched per utterance
  }

  speak(text: string, rate: number, onEnd: () => void): void {
    this.stop(); // cancel any previous utterance
    this.onEndCurrent = onEnd;
    this.paused = false;

    this.abortCtl = new AbortController();
    const { signal } = this.abortCtl;

    fetch("/api/avatar/tts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text, speed: rate }),
      signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`TTS error ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (signal.aborted) return;
        const url = URL.createObjectURL(blob);
        this.audio = new Audio(url);
        this.audio.playbackRate = rate;
        this.audio.onended = () => {
          URL.revokeObjectURL(url);
          const cb = this.onEndCurrent;
          this.onEndCurrent = null;
          if (!signal.aborted) cb?.();
        };
        this.audio.onerror = () => {
          URL.revokeObjectURL(url);
          const cb = this.onEndCurrent;
          this.onEndCurrent = null;
          cb?.();
        };
        this.audio.play().catch(() => {
          const cb = this.onEndCurrent;
          this.onEndCurrent = null;
          cb?.();
        });
      })
      .catch(err => {
        if ((err as Error).name === "AbortError") return;
        console.error("[OpenAI TTS]", err);
        const cb = this.onEndCurrent;
        this.onEndCurrent = null;
        cb?.();
      });
  }

  pause(): void {
    this.paused = true;
    this.audio?.pause();
  }

  resume(): void {
    this.paused = false;
    this.audio?.play().catch(() => {});
  }

  stop(): void {
    this.abortCtl?.abort();
    this.abortCtl = null;
    this.onEndCurrent = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    this.paused = false;
  }

  destroy(): void { this.stop(); }
}
