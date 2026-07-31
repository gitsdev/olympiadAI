import * as THREE from "three";
import type { GestureName, ExpressionName } from "./types";

/* ══════════════════════════════════════════════════════════
   AnimationController
   Manages a THREE.AnimationMixer with three independent layers:
     Layer 0 — full body base (idle / walk / breathe)
     Layer 1 — upper body overlay (talking, gestures) — masks legs
     Layer 2 — face only (expressions, lip sync)
   ══════════════════════════════════════════════════════════ */

const FADE = 0.35;   // cross-fade duration in seconds
const GESTURE_DURATION: Partial<Record<GestureName, number>> = {
  open_hands: 2.4, point_right: 1.8, one_hand: 2.0, two_hands: 2.2,
  raise_finger: 1.6, nod: 1.2, count_fingers: 2.8, lean_forward: 2.0,
  thumbs_up: 1.4, small_applause: 2.0, positive_nod: 1.4,
  hand_chin: 2.0, look_up: 1.4, head_tilt: 1.2,
  raise_hand: 1.6, slow_shake: 1.8,
  big_smile: 1.8, clap: 2.4, excited: 2.0, wave: 2.0,
};

/* Blend shape presets keyed by expression name */
const EXPRESSION_MORPHS: Record<ExpressionName, Record<string, number>> = {
  neutral:     {},
  happy:       { mouthSmile: 0.7, cheekPuff: 0.1 },
  curious:     { browInnerUp: 0.4, eyeWideLeft: 0.3, eyeWideRight: 0.3 },
  thinking:    { browDownLeft: 0.3, eyeLookUpLeft: 0.2, eyeLookUpRight: 0.2 },
  serious:     { browDownLeft: 0.4, browDownRight: 0.4, mouthPressLeft: 0.3, mouthPressRight: 0.3 },
  surprised:   { browInnerUp: 0.8, eyeWideLeft: 0.7, eyeWideRight: 0.7, jawOpen: 0.2 },
  encouraging: { mouthSmile: 0.5, browInnerUp: 0.3 },
  proud:       { mouthSmile: 0.4, headNod: 0.3 },
  concerned:   { browDownLeft: 0.5, browDownRight: 0.5, mouthFrownLeft: 0.3, mouthFrownRight: 0.3 },
};

/* Lip-sync viseme → blend shape mapping (ARKit / ReadyPlayerMe convention) */
const VISEME_MORPHS: Record<string, Record<string, number>> = {
  aa: { jawOpen: 0.7, mouthOpen: 0.8, viseme_aa: 1.0 },
  ee: { mouthSmile: 0.4, viseme_E: 1.0 },
  ih: { viseme_I: 1.0, mouthSmile: 0.15 },
  oh: { jawOpen: 0.4, mouthFunnel: 0.6, viseme_O: 1.0 },
  ou: { mouthPucker: 0.7, viseme_U: 1.0 },
  nn: { mouthClose: 0.3 },
  sil:{}
};

export class AnimationController {
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private morphMeshes: THREE.SkinnedMesh[] = [];

  /* Current state */
  private currentBase    = "";
  private currentUpper   = "";
  private currentExpr    = "neutral" as ExpressionName;
  private speaking       = false;
  private gestureTimer: ReturnType<typeof setTimeout> | null = null;

  /* Morph weights — lerped each frame */
  private morphTargets  = new Map<string, number>(); // target weights
  private morphCurrent  = new Map<string, number>(); // current (lerped)

  constructor(mixer: THREE.AnimationMixer, morphMeshes: THREE.SkinnedMesh[]) {
    this.mixer       = mixer;
    this.morphMeshes = morphMeshes;
  }

  /* ── Register a clip ── */
  register(name: string, clip: THREE.AnimationClip): void {
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    this.actions.set(name, action);
  }

  /* ── Base layer (full body) ── */
  playBase(name: string): void {
    if (name === this.currentBase) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.currentBase);
    if (prev) {
      next.reset().play();
      next.crossFadeFrom(prev, FADE, true);
    } else {
      next.reset().play();
      next.fadeIn(FADE);
    }
    this.currentBase = name;
  }

  /* ── Upper-body overlay ── */
  playUpperBody(name: string | null, fadeOut = false): void {
    const prev = this.actions.get(this.currentUpper);
    if (name === this.currentUpper && !fadeOut) return;
    if (prev) prev.fadeOut(FADE);
    this.currentUpper = "";
    if (!name) return;
    const next = this.actions.get(name);
    if (!next) return;
    next.reset().fadeIn(FADE).play();
    next.setLoop(THREE.LoopRepeat, Infinity);
    this.currentUpper = name;
  }

  /* ── One-shot gesture (returns to idle after duration) ── */
  playGesture(name: GestureName): void {
    if (this.gestureTimer) clearTimeout(this.gestureTimer);
    const clipName = `gesture_${name}`;
    const action   = this.actions.get(clipName);
    if (!action) {
      /* fallback: blend to a talk clip if no gesture clip exists */
      this.playUpperBody(this.speaking ? "talk_explain" : null);
      return;
    }
    action.reset().fadeIn(FADE).play();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    const dur = (action.getClip().duration || GESTURE_DURATION[name] || 2.0) * 1000;
    this.gestureTimer = setTimeout(() => {
      action.fadeOut(FADE);
      if (this.speaking && this.currentUpper) this.playUpperBody("talk_base");
    }, dur - FADE * 1000);
  }

  /* ── Expression (face morph targets) ── */
  setExpression(name: ExpressionName): void {
    if (name === this.currentExpr) return;
    this.currentExpr = name;
    const morphs = EXPRESSION_MORPHS[name] ?? {};
    /* Clear all expression morphs, then set target */
    const exprKeys = new Set(Object.values(EXPRESSION_MORPHS).flatMap(m => Object.keys(m)));
    for (const k of exprKeys) this.morphTargets.set(k, 0);
    for (const [k, v] of Object.entries(morphs)) this.morphTargets.set(k, v);
  }

  /* ── Lip sync ── */
  setSpeaking(on: boolean): void {
    this.speaking = on;
    if (!on) this.setViseme("sil");
  }

  setViseme(vis: string): void {
    const morphs = VISEME_MORPHS[vis] ?? {};
    /* Only touch viseme keys */
    const visemeKeys = new Set(Object.values(VISEME_MORPHS).flatMap(m => Object.keys(m)));
    for (const k of visemeKeys) this.morphTargets.set(k, 0);
    for (const [k, v] of Object.entries(morphs)) this.morphTargets.set(k, v);
  }

  /* ── Blink helper (called externally on a timer) ── */
  blink(): void {
    this.morphTargets.set("eyeBlinkLeft",  1);
    this.morphTargets.set("eyeBlinkRight", 1);
    setTimeout(() => {
      this.morphTargets.set("eyeBlinkLeft",  0);
      this.morphTargets.set("eyeBlinkRight", 0);
    }, 130);
  }

  /* ── Per-frame update: lerp morph targets ── */
  update(dt: number): void {
    this.mixer.update(dt);
    const speed = Math.min(1, dt * 16);
    for (const [key, target] of this.morphTargets) {
      const cur  = this.morphCurrent.get(key) ?? 0;
      const next = cur + (target - cur) * speed;
      this.morphCurrent.set(key, next);
      this.applyMorph(key, next);
    }
  }

  private applyMorph(name: string, weight: number): void {
    for (const mesh of this.morphMeshes) {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;
      const idx = mesh.morphTargetDictionary[name];
      if (idx !== undefined) mesh.morphTargetInfluences[idx] = weight;
    }
  }

  dispose(): void {
    if (this.gestureTimer) clearTimeout(this.gestureTimer);
    this.mixer.stopAllAction();
  }
}
