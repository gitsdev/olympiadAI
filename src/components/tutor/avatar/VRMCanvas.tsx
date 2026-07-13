"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";

/* ── Public interface ── */
export interface VRMCanvasHandle {
  setViseme(name: string, weight: number): void;
  setSpeaking(on: boolean): void;
}

/* ── CDN fallback VRM (three-vrm example model, MIT licensed) ── */
const DEFAULT_VRM_URL =
  "https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

/* ═══════════════════════════════════════ COMPONENT ══ */

interface Props {
  url?: string;
  width?: number;
  height?: number;
}

const VRMCanvas = forwardRef<VRMCanvasHandle, Props>(
  ({ url = DEFAULT_VRM_URL, width = 284, height = 220 }, ref) => {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const vrmRef     = useRef<VRM | null>(null);
    const speakRef   = useRef(false);
    const visemeRef  = useRef<{ name: string; target: number }>({ name: "aa", target: 0 });
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [errMsg,  setErrMsg]  = useState("");

    /* expose to parent */
    useImperativeHandle(ref, () => ({
      setViseme(name: string, weight: number) {
        visemeRef.current = { name, target: weight };
      },
      setSpeaking(on: boolean) {
        speakRef.current = on;
        if (!on) visemeRef.current = { name: "aa", target: 0 };
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      /* ── Renderer ── */
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      /* ── Scene & camera ── */
      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 20);
      camera.position.set(0, 1.38, 2.2);
      camera.lookAt(0, 1.38, 0);

      /* ── Lighting ── */
      scene.add(new THREE.AmbientLight(0xffeedd, 1.1));
      const key = new THREE.DirectionalLight(0xfff8f0, 1.4);
      key.position.set(1, 2, 2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xddeeff, 0.5);
      fill.position.set(-2, 1, 1);
      scene.add(fill);

      /* ── Load VRM (tries url first, falls back to CDN if local 404) ── */
      const loader = new GLTFLoader();
      loader.register(parser => new VRMLoaderPlugin(parser));

      const onLoaded = (gltf: { userData: { vrm?: VRM } }) => {
        const vrm = gltf.userData.vrm as VRM | undefined;
        if (!vrm) { setErrMsg("VRM data missing in GLTF"); setStatus("error"); return; }
        vrmRef.current = vrm;
        vrm.scene.rotation.y = Math.PI;
        scene.add(vrm.scene);
        setStatus("ready");
      };

      const loadUrl = async () => {
        // If a local path is given, HEAD-check it first so we avoid a noisy 404 in the loader.
        let resolvedUrl = url;
        if (url.startsWith("/")) {
          const probe = await fetch(url, { method: "HEAD" }).catch(() => null);
          if (!probe?.ok) resolvedUrl = DEFAULT_VRM_URL;
        }
        loader.load(
          resolvedUrl,
          onLoaded,
          undefined,
          err => {
            console.error("[VRMCanvas] load error:", err);
            if (resolvedUrl !== DEFAULT_VRM_URL) {
              // retry with CDN fallback
              loader.load(DEFAULT_VRM_URL, onLoaded, undefined, () => {
                setErrMsg("Could not load VRM model");
                setStatus("error");
              });
            } else {
              setErrMsg("Could not load VRM model");
              setStatus("error");
            }
          },
        );
      };

      loadUrl();

      /* ── Animation state ── */
      let blinkTimer  = 2 + Math.random() * 3; // seconds until next blink
      let blinkPhase  = 0; // 0=open, 1=closing, 2=opening
      let blinkWeight = 0;
      let headSwayT   = 0;
      let speakAnim   = 0; // 0–1 speaking intensity
      const PREV_VISEMES = new Map<string, number>(); // current weights for smooth reset

      let   lastTime = performance.now();
      let   rafId    = 0;

      const loop = () => {
        rafId         = requestAnimationFrame(loop);
        const now     = performance.now();
        const dt      = (now - lastTime) / 1000;
        lastTime      = now;
        const vrm = vrmRef.current;
        if (!vrm) { renderer.render(scene, camera); return; }

        const em = vrm.expressionManager;

        /* ── Blink ── */
        blinkTimer -= dt;
        if (blinkPhase === 0 && blinkTimer <= 0) blinkPhase = 1;
        if (blinkPhase === 1) {
          blinkWeight = Math.min(1, blinkWeight + dt * 10);
          if (blinkWeight >= 1) blinkPhase = 2;
        } else if (blinkPhase === 2) {
          blinkWeight = Math.max(0, blinkWeight - dt * 8);
          if (blinkWeight <= 0) {
            blinkPhase = 0;
            blinkTimer = 3 + Math.random() * 3;
          }
        }
        em?.setValue("blink", blinkWeight);

        /* ── Head sway (idle) ── */
        headSwayT += dt;
        const head = vrm.humanoid.getNormalizedBoneNode("head");
        if (head) {
          head.rotation.y = Math.sin(headSwayT * 0.28) * 0.055;
          head.rotation.z = Math.sin(headSwayT * 0.19) * 0.025;
        }
        /* Subtle spine breathing */
        const spine = vrm.humanoid.getNormalizedBoneNode("spine");
        if (spine) {
          spine.rotation.x = Math.sin(headSwayT * 0.4) * 0.012;
        }

        /* ── Lip sync ── */
        const { name: vis, target } = visemeRef.current;
        const MOUTH_NAMES: string[] = ["aa", "ih", "ou", "ee", "oh"];

        // decay all mouth visemes toward 0 except the active one
        for (const mn of MOUTH_NAMES) {
          const prev  = PREV_VISEMES.get(mn) ?? 0;
          const tgt   = mn === vis ? target : 0;
          const next  = prev + (tgt - prev) * Math.min(1, dt * 14);
          em?.setValue(mn, next);
          PREV_VISEMES.set(mn, next);
        }

        /* Speaking head micro-bounce */
        if (speakRef.current) {
          speakAnim += dt * 6;
          if (head) head.rotation.x = Math.sin(speakAnim) * 0.018;
        } else {
          if (head) head.rotation.x += (0 - head.rotation.x) * Math.min(1, dt * 4);
        }

        vrm.update(dt);
        renderer.render(scene, camera);
      };

      loop();

      return () => {
        cancelAnimationFrame(rafId);
        renderer.dispose();
        vrmRef.current = null;
      };
    }, [url, width, height]);

    return (
      <div style={{ position: "relative", width, height }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
        {status === "loading" && (
          <div style={{
            position:"absolute", inset:0, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:8,
            background:"var(--cobalt-50)",
          }}>
            <div style={{
              width:32, height:32, borderRadius:"50%",
              border:"3px solid var(--cobalt-200)",
              borderTopColor:"var(--cobalt-500)",
              animation:"vrm-spin 0.9s linear infinite",
            }} />
            <p style={{ fontSize:11, color:"var(--fg-muted)", margin:0 }}>Loading 3D teacher…</p>
          </div>
        )}
        {status === "error" && (
          <div style={{
            position:"absolute", inset:0, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:6, padding:16,
            background:"var(--cobalt-50)",
          }}>
            <span style={{ fontSize:22 }}>🧑‍🏫</span>
            <p style={{ fontSize:11, color:"var(--fg-muted)", textAlign:"center", margin:0 }}>
              {errMsg || "VRM model unavailable"}<br />
              <a
                href="https://hub.vroid.com/en/characters?category=free"
                target="_blank" rel="noopener noreferrer"
                style={{ color:"var(--cobalt-600)", fontSize:10 }}
              >
                Download a free VRM → place at /public/teacher.vrm
              </a>
            </p>
          </div>
        )}
        <style>{`@keyframes vrm-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  },
);

VRMCanvas.displayName = "VRMCanvas";
export default VRMCanvas;
