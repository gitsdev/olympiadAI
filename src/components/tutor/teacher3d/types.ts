import type * as THREE from "three";

/* ══════════════════════════════ LESSON ══ */

export type SlideKind =
  | "welcome" | "intro" | "explain" | "visual"
  | "insight" | "step" | "question" | "summary";

export interface Slide {
  id:      string;
  kind:    SlideKind;
  text:    string;
  options?: string[];
  correct?: number;
  why?:    string;
}

/* ══════════════════════════════ TEACHER GENDER ══ */

export type TeacherGender = "female" | "male";

/* ══════════════════════════════ ANIMATION ══ */

export type IdleClip     = "idle" | "idle_look" | "breathe";
export type TalkClip     = "talk_base" | "talk_explain" | "talk_lecture";
export type GestureName  =
  | "open_hands" | "point_right" | "one_hand" | "two_hands"
  | "raise_finger" | "nod" | "count_fingers" | "lean_forward"
  | "thumbs_up" | "small_applause" | "positive_nod"
  | "hand_chin" | "look_up" | "head_tilt"
  | "raise_hand" | "slow_shake"
  | "big_smile" | "clap" | "excited"
  | "wave";

export type ExpressionName =
  | "neutral" | "happy" | "curious" | "thinking"
  | "serious" | "surprised" | "encouraging" | "proud" | "concerned";

export type AnimationLayer = "base" | "upper" | "face";

export interface AnimationState {
  base:       string;
  upperBody:  string | null;
  expression: ExpressionName;
  speaking:   boolean;
}

/* ══════════════════════════════ SPEECH ══ */

export interface VisemeEvent {
  viseme:  string;   // aa | ee | ih | oh | ou
  weight:  number;
  wordIdx: number;
}

export interface SpeechEvent {
  type:     "start" | "end" | "word" | "viseme";
  text?:    string;
  charIdx?: number;
  viseme?:  VisemeEvent;
}

/* ══════════════════════════════ TEACHER COMMAND ══ */

export type TeacherCommand =
  | { type: "speak";     text: string; rate?: number }
  | { type: "gesture";   name: GestureName }
  | { type: "express";   emotion: ExpressionName }
  | { type: "idle" }
  | { type: "celebrate" }
  | { type: "think" };

/* ══════════════════════════════ SCENE REFS ══ */

export interface TeacherRefs {
  mixer:     THREE.AnimationMixer | null;
  model:     THREE.Group | null;
  morphs:    Map<string, THREE.Mesh>;   // meshes with morph targets
  bones:     Map<string, THREE.Bone>;
  clips:     Map<string, THREE.AnimationClip>;
  actions:   Map<string, THREE.AnimationAction>;
}
