import type { AvatarProvider } from "./types";

/* Web Speech API fallback — always available, no API key required.
   Voice quality is browser-dependent. Prefers Google/Apple voices when
   available. Used when neither HEYGEN_API_KEY nor OPENAI_API_KEY is set. */

export class WebSpeechProvider implements AvatarProvider {
  readonly id          = "browser";
  readonly displayName = "Browser Voice (Web Speech API)";
  readonly hasVideo    = false;

  async initialize(): Promise<void> {
    // Warm up voice list (required on some browsers)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }

  speak(text: string, rate: number, onEnd: () => void): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd(); return;
    }
    window.speechSynthesis.cancel();
    const u   = new SpeechSynthesisUtterance(text);
    u.rate    = rate;
    u.pitch   = 1.05;
    const pick = () => {
      const vv = window.speechSynthesis.getVoices();
      const v  = vv.find(v => /Google UK English Female|Samantha|Karen|Moira|Serena/i.test(v.name))
              ?? vv.find(v => v.lang.startsWith("en") && v.localService)
              ?? vv.find(v => v.lang.startsWith("en"))
              ?? null;
      if (v) u.voice = v;
    };
    if (window.speechSynthesis.getVoices().length) pick();
    else window.speechSynthesis.onvoiceschanged = pick;
    u.onend   = () => onEnd();
    u.onerror = () => onEnd();
    window.speechSynthesis.speak(u);
  }

  pause()  { if (typeof window !== "undefined") window.speechSynthesis?.pause(); }
  resume() { if (typeof window !== "undefined") window.speechSynthesis?.resume(); }
  stop()   { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }
  destroy(): void { this.stop(); }
}
