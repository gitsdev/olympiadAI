/* ═══════════════════════════════════════════════════════════
   LessonBridge
   Converts a lesson Slide into a stream of TeacherCommands.
   Instantiated once per lesson; call `processSlide(slide)` to
   enqueue commands, and `flush()` to reset between lessons.
   ═══════════════════════════════════════════════════════════ */

import type { Slide, SlideKind, TeacherCommand, ExpressionName } from "./types";
import { GestureLibrary } from "./GestureLibrary";

const SLIDE_EXPRESSION: Record<SlideKind, ExpressionName> = {
  welcome:  "happy",
  intro:    "encouraging",
  explain:  "neutral",
  visual:   "curious",
  insight:  "surprised",
  step:     "neutral",
  question: "thinking",
  summary:  "proud",
};

export class LessonBridge {
  private gestureLib = new GestureLibrary();
  private timers:    ReturnType<typeof setTimeout>[] = [];

  /**
   * Emit TeacherCommands for one slide.
   * `dispatch` will be called immediately for express/speak,
   * and on timers for subsequent gestures.
   */
  processSlide(slide: Slide, dispatch: (cmd: TeacherCommand) => void): void {
    this.flush();

    /* 1. Set expression */
    const expr = SLIDE_EXPRESSION[slide.kind] ?? "neutral";
    dispatch({ type: "express", emotion: expr });

    /* 2. Speak the slide text */
    dispatch({ type: "speak", text: this.buildText(slide) });

    /* 3. Schedule gestures */
    const sequences = this.gestureLib.forSlide(slide.kind);
    for (const seq of sequences) {
      const t = setTimeout(() => {
        dispatch({ type: "gesture",  name:    seq.gesture });
        dispatch({ type: "express",  emotion: seq.expression });
      }, seq.delayMs);
      this.timers.push(t);
    }

    /* 4. For questions, add a "think" sequence after speech starts */
    if (slide.kind === "question") {
      const thinkSeqs = this.gestureLib.think();
      for (const seq of thinkSeqs) {
        const t = setTimeout(() => dispatch({ type: "gesture", name: seq.gesture }), seq.delayMs + 600);
        this.timers.push(t);
      }
    }
  }

  /** Celebrate correct answer / milestone */
  celebrate(dispatch: (cmd: TeacherCommand) => void): void {
    this.flush();
    dispatch({ type: "celebrate" });
    const seqs = this.gestureLib.celebrate();
    for (const seq of seqs) {
      const t = setTimeout(() => {
        dispatch({ type: "gesture", name: seq.gesture });
        dispatch({ type: "express", emotion: seq.expression });
      }, seq.delayMs);
      this.timers.push(t);
    }
  }

  /** Cancel all pending gesture timers */
  flush(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Build the full text the teacher should say for a slide */
  private buildText(slide: Slide): string {
    const parts: string[] = [slide.text];

    if (slide.kind === "question" && slide.options?.length) {
      const opts = slide.options.map((o, i) => `Option ${i + 1}: ${o}`).join(". ");
      parts.push(opts);
    }

    if (slide.kind === "insight" && slide.why) {
      parts.push(slide.why);
    }

    return parts.join(" ");
  }
}
