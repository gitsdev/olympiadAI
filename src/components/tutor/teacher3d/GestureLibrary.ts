/* ═══════════════════════════════════════════════════════════
   GestureLibrary
   Maps lesson context → gesture sequences.
   The AnimationController picks gesture clips named
   `gesture_<name>`.  If the clip doesn't exist in the loaded
   model the controller falls back gracefully.
   ═══════════════════════════════════════════════════════════ */

import type { GestureName, ExpressionName, SlideKind } from "./types";

export interface GestureSequence {
  gesture:    GestureName;
  expression: ExpressionName;
  delayMs:    number;   // ms after speech starts to trigger gesture
}

/* Slide-kind → gestures that feel natural for that kind */
const SLIDE_GESTURES: Record<SlideKind, GestureSequence[]> = {
  welcome:   [
    { gesture: "wave",       expression: "happy",       delayMs: 400  },
    { gesture: "open_hands", expression: "encouraging", delayMs: 3000 },
  ],
  intro:     [
    { gesture: "one_hand",   expression: "curious",     delayMs: 600  },
    { gesture: "open_hands", expression: "neutral",     delayMs: 3500 },
  ],
  explain:   [
    { gesture: "two_hands",    expression: "neutral",   delayMs: 800  },
    { gesture: "point_right",  expression: "serious",   delayMs: 4000 },
    { gesture: "raise_finger", expression: "neutral",   delayMs: 7000 },
  ],
  visual:    [
    { gesture: "open_hands",  expression: "curious",   delayMs: 600  },
    { gesture: "two_hands",   expression: "neutral",   delayMs: 4500 },
  ],
  insight:   [
    { gesture: "raise_finger", expression: "surprised", delayMs: 500  },
    { gesture: "lean_forward", expression: "serious",   delayMs: 3000 },
  ],
  step:      [
    { gesture: "count_fingers", expression: "neutral",     delayMs: 800  },
    { gesture: "one_hand",      expression: "encouraging", delayMs: 5000 },
  ],
  question:  [
    { gesture: "hand_chin",   expression: "thinking",    delayMs: 800  },
    { gesture: "look_up",     expression: "curious",     delayMs: 3000 },
  ],
  summary:   [
    { gesture: "open_hands",    expression: "encouraging", delayMs: 500  },
    { gesture: "small_applause",expression: "happy",       delayMs: 5000 },
  ],
};

/* Contextual keyword → gesture override (triggers on word boundary) */
const KEYWORD_GESTURES: Array<{ words: string[]; gesture: GestureName; expression: ExpressionName }> = [
  { words: ["remember", "important", "key"],    gesture: "raise_finger", expression: "serious"     },
  { words: ["great", "excellent", "well done"], gesture: "thumbs_up",    expression: "proud"       },
  { words: ["think", "consider", "wonder"],     gesture: "hand_chin",    expression: "thinking"    },
  { words: ["look", "see", "notice"],           gesture: "point_right",  expression: "curious"     },
  { words: ["because", "therefore", "so"],      gesture: "open_hands",   expression: "neutral"     },
  { words: ["first", "one", "1"],               gesture: "count_fingers",expression: "neutral"     },
  { words: ["congratulations", "amazing"],      gesture: "clap",         expression: "happy"       },
  { words: ["careful", "warning", "mistake"],   gesture: "slow_shake",   expression: "concerned"   },
  { words: ["exactly", "perfect", "correct"],   gesture: "positive_nod", expression: "encouraging" },
];

export class GestureLibrary {
  /** Return gesture sequence for a slide kind */
  forSlide(kind: SlideKind): GestureSequence[] {
    return SLIDE_GESTURES[kind] ?? SLIDE_GESTURES.explain;
  }

  /** Return a gesture override if the word matches a keyword, else null */
  forWord(word: string): { gesture: GestureName; expression: ExpressionName } | null {
    const lower = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const row of KEYWORD_GESTURES) {
      if (row.words.some(w => lower.startsWith(w))) return { gesture: row.gesture, expression: row.expression };
    }
    return null;
  }

  /** Celebration sequence (correct answer, lesson end) */
  celebrate(): GestureSequence[] {
    return [
      { gesture: "thumbs_up",     expression: "happy",       delayMs: 200  },
      { gesture: "small_applause",expression: "proud",        delayMs: 1600 },
      { gesture: "big_smile",     expression: "encouraging",  delayMs: 3200 },
    ];
  }

  /** Thinking sequence (generating, processing) */
  think(): GestureSequence[] {
    return [
      { gesture: "hand_chin", expression: "thinking", delayMs: 300  },
      { gesture: "look_up",   expression: "curious",  delayMs: 2500 },
      { gesture: "head_tilt", expression: "thinking", delayMs: 4500 },
    ];
  }
}
