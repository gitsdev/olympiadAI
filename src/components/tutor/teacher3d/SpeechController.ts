/* ═══════════════════════════════════════════════════════════
   SpeechController
   Wraps Web Speech API. Fires granular callbacks so the
   AnimationController can do lip sync and speaking animations.
   ═══════════════════════════════════════════════════════════ */

type VisemeName = "aa" | "ee" | "ih" | "oh" | "ou" | "nn" | "sil";

/* Character → viseme (dominant phoneme) */
const CHAR_VISEME: Record<string, VisemeName> = {
  a:"aa", á:"aa", à:"aa", â:"aa", ä:"aa",
  e:"ee", é:"ee", è:"ee", ê:"ee", ë:"ee",
  i:"ih", í:"ih", ì:"ih", î:"ih", y:"ih",
  o:"oh", ó:"oh", ò:"oh", ô:"oh", ö:"oh",
  u:"ou", ú:"ou", ù:"ou", û:"ou", w:"ou",
  n:"nn", m:"nn", ng:"nn",
};

function wordViseme(word: string): VisemeName {
  for (const ch of word.toLowerCase()) {
    const v = CHAR_VISEME[ch];
    if (v) return v;
  }
  return "aa";
}

export interface SpeechCallbacks {
  onStart():                         void;
  onEnd():                           void;
  onViseme(v: VisemeName, w: number): void;
}

export class SpeechController {
  private rate        = 1.0;
  private callbacks:  SpeechCallbacks;
  private utterance:  SpeechSynthesisUtterance | null = null;
  private visTimer:   ReturnType<typeof setTimeout> | null = null;
  private voice:      SpeechSynthesisVoice | null = null;

  constructor(callbacks: SpeechCallbacks) {
    this.callbacks = callbacks;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const pick = () => {
        const voices = window.speechSynthesis.getVoices();
        this.voice =
          voices.find(v => /Google UK English Female|Samantha|Karen|Serena|Moira/i.test(v.name)) ??
          voices.find(v => v.lang.startsWith("en") && v.localService) ??
          voices.find(v => v.lang.startsWith("en")) ??
          null;
      };
      if (window.speechSynthesis.getVoices().length) pick();
      else window.speechSynthesis.onvoiceschanged = pick;
    }
  }

  setRate(rate: number): void { this.rate = rate; }

  speak(text: string): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.callbacks.onStart();
      this.callbacks.onEnd();
      return;
    }
    window.speechSynthesis.cancel();

    const u        = new SpeechSynthesisUtterance(text);
    u.rate         = this.rate;
    u.pitch        = 1.05;
    if (this.voice) u.voice = this.voice;
    this.utterance = u;

    u.onstart = () => this.callbacks.onStart();

    u.onboundary = (ev) => {
      if (ev.name !== "word") return;
      const raw  = text.slice(ev.charIndex, ev.charIndex + ((ev as SpeechSynthesisEvent & {charLength?:number}).charLength ?? 8));
      const word = raw.replace(/[^a-záàâäéèêëíìîïóòôöúùûüyw]/gi, "");
      const vis  = wordViseme(word);

      if (this.visTimer) clearTimeout(this.visTimer);
      this.callbacks.onViseme(vis, 0.9);

      const ms = Math.max(80, (word.length * 58) / this.rate);
      this.visTimer = setTimeout(() => this.callbacks.onViseme("sil", 0), ms);
    };

    u.onend   = () => { this.visTimer && clearTimeout(this.visTimer); this.callbacks.onViseme("sil", 0); this.callbacks.onEnd(); };
    u.onerror = () => { this.visTimer && clearTimeout(this.visTimer); this.callbacks.onViseme("sil", 0); this.callbacks.onEnd(); };

    window.speechSynthesis.speak(u);
  }

  pause():  void { window.speechSynthesis?.pause();  }
  resume(): void { window.speechSynthesis?.resume(); }
  stop():   void {
    this.visTimer && clearTimeout(this.visTimer);
    window.speechSynthesis?.cancel();
    this.callbacks.onViseme("sil", 0);
  }
  destroy(): void { this.stop(); }
}
