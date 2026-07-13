import type { AvatarProvider } from "./types";

type VisemeCb = (name: string, weight: number) => void;

const VOWEL_VISEME: Record<string, string> = {
  a:"aa", á:"aa", à:"aa", â:"aa", ä:"aa",
  e:"ee", é:"ee", è:"ee", ê:"ee", ë:"ee",
  i:"ih", í:"ih", ì:"ih", î:"ih", ï:"ih", y:"ih",
  o:"oh", ó:"oh", ò:"oh", ô:"oh", ö:"oh",
  u:"ou", ú:"ou", ù:"ou", û:"ou", ü:"ou", w:"ou",
};

function wordViseme(word: string): string {
  for (const ch of word.toLowerCase()) if (VOWEL_VISEME[ch]) return VOWEL_VISEME[ch];
  return "aa";
}

export class WebSpeechProvider implements AvatarProvider {
  readonly id          = "browser";
  readonly displayName = "Browser Voice (Web Speech API)";
  readonly hasVideo    = false;

  private onViseme?: VisemeCb;

  constructor(onViseme?: VisemeCb) {
    this.onViseme = onViseme;
  }

  async initialize(): Promise<void> {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }

  speak(text: string, rate: number, onEnd: () => void): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { onEnd(); return; }
    window.speechSynthesis.cancel();

    const u   = new SpeechSynthesisUtterance(text);
    u.rate    = rate;
    u.pitch   = 1.05;

    const pickVoice = () => {
      const vv = window.speechSynthesis.getVoices();
      const v  = vv.find(v => /Google UK English Female|Samantha|Karen|Moira|Serena/i.test(v.name))
              ?? vv.find(v => v.lang.startsWith("en") && v.localService)
              ?? vv.find(v => v.lang.startsWith("en"))
              ?? null;
      if (v) u.voice = v;
    };
    if (window.speechSynthesis.getVoices().length) pickVoice();
    else window.speechSynthesis.onvoiceschanged = pickVoice;

    if (this.onViseme) {
      const onViseme = this.onViseme;
      let visemeTimer: ReturnType<typeof setTimeout> | null = null;

      u.onboundary = (ev) => {
        if (ev.name !== "word") return;
        const word = text.slice(ev.charIndex, ev.charIndex + ((ev as SpeechSynthesisEvent & { charLength?: number }).charLength ?? 6));
        const vis  = wordViseme(word);
        onViseme(vis, 0.75);
        const dur = Math.max(120, (word.length * 65) / rate);
        if (visemeTimer) clearTimeout(visemeTimer);
        visemeTimer = setTimeout(() => onViseme(vis, 0), dur);
      };
      u.onend = () => {
        if (visemeTimer) clearTimeout(visemeTimer);
        onViseme("aa", 0);
        onEnd();
      };
      u.onerror = () => {
        if (visemeTimer) clearTimeout(visemeTimer);
        onViseme("aa", 0);
        onEnd();
      };
    } else {
      u.onend   = () => onEnd();
      u.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(u);
  }

  pause()   { if (typeof window !== "undefined") window.speechSynthesis?.pause();  }
  resume()  { if (typeof window !== "undefined") window.speechSynthesis?.resume(); }
  stop()    {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.onViseme?.("aa", 0);
  }
  destroy() { this.stop(); }
}
