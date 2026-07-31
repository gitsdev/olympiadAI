"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GestureName, ExpressionName, TeacherGender } from "./types";

export interface TeacherSceneHandle {
  setSpeaking(on: boolean):             void;
  setViseme(vis: string, w: number):    void;
  playGesture(name: GestureName):       void;
  setExpression(name: ExpressionName):  void;
  idle():                               void;
}

interface Props {
  gender?: TeacherGender;
  width?:  number;
  height?: number;
}

/* Three.js creates its own canvas and we append it to a div.
   This means every mount gets a brand-new canvas / WebGL context,
   which avoids the context-reuse bug triggered by React StrictMode. */
const TeacherScene = forwardRef<TeacherSceneHandle, Props>(
  ({ gender = "female", width = 284, height = 220 }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

    /* Stub imperative handle — extend later with real animation control */
    useImperativeHandle(ref, () => ({
      setSpeaking()   {},
      setViseme()     {},
      playGesture()   {},
      setExpression() {},
      idle()          {},
    }));

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;
      let active = true;

      /* ── Renderer (creates its own canvas element) ── */
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping       = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
      mount.appendChild(renderer.domElement);

      /* ── Scene ── */
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1e1b2e);   // dark purple — always visible

      /* ── Camera ── */
      const camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 50);
      camera.position.set(0, 1.4, 2.6);
      camera.lookAt(0, 1.05, 0);

      /* ── Lighting ── */
      scene.add(new THREE.AmbientLight(0xffeedd, 0.9));
      const key = new THREE.DirectionalLight(0xfff8f0, 2.2);
      key.position.set(1.5, 3, 2.5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xc8d8ff, 0.7);
      fill.position.set(-2, 1.5, 1);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffe8c0, 0.4);
      rim.position.set(0, 2, -3);
      scene.add(rim);

      /* ── Render loop — starts immediately so background shows while loading ── */
      let animId   = 0;
      let lastTime = performance.now();
      let swayT    = 0;
      let headBone: THREE.Bone | null = null;

      const animate = () => {
        animId       = requestAnimationFrame(animate);
        const now    = performance.now();
        const dt     = Math.min((now - lastTime) / 1000, 0.05);
        lastTime     = now;
        swayT       += dt;
        if (mixerRef.current) mixerRef.current.update(dt);
        if (headBone) {
          headBone.rotation.y = Math.sin(swayT * 0.28) * 0.045;
          headBone.rotation.z = Math.sin(swayT * 0.19) * 0.02;
        }
        renderer.render(scene, camera);
      };
      animate();

      /* ── Load character ── */
      const charUrl = gender === "female" ? "/teacher-female.glb" : "/teacher-male.glb";
      new GLTFLoader().load(
        charUrl,
        gltf => {
          if (!active) return;

          const model = gltf.scene;

          /* Scale to roughly 1.6 m height */
          const box  = new THREE.Box3().setFromObject(model);
          const h    = box.max.y - box.min.y;
          if (h > 0) {
            const s = 1.65 / h;
            model.scale.setScalar(s);
            /* Sit feet on y = 0 */
            const newBox = new THREE.Box3().setFromObject(model);
            model.position.y = -newBox.min.y;
          }

          scene.add(model);

          /* Play embedded animation if any */
          if (gltf.animations.length > 0) {
            const mixer  = new THREE.AnimationMixer(model);
            mixerRef.current = mixer;
            const clip   =
              gltf.animations.find(a => /idle/i.test(a.name)) ??
              gltf.animations.find(a => /tpose/i.test(a.name)) ??
              gltf.animations[0];
            mixer.clipAction(clip).play();
          }

          /* Head bone for gentle idle sway */
          model.traverse(obj => {
            const bone = obj as THREE.Bone;
            if (bone.isBone) {
              const n = bone.name.toLowerCase();
              if (n.includes("head") && !n.includes("top") && !n.includes("end")) {
                headBone = bone;
              }
            }
          });

          setStatus("ready");
        },
        undefined,
        () => { if (active) setStatus("error"); },
      );

      return () => {
        active = false;
        cancelAnimationFrame(animId);
        mixerRef.current = null;
        if (mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gender, width, height]);

    return (
      <div
        ref={mountRef}
        style={{ width, height, position: "relative", overflow: "hidden", background: "#1e1b2e" }}
      >
        {status === "loading" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "3px solid #334155",
              borderTopColor: "#6366f1",
              animation: "t3d-spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>Loading teacher…</p>
          </div>
        )}
        {status === "error" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>Model unavailable</p>
          </div>
        )}
        <style>{`@keyframes t3d-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  },
);

TeacherScene.displayName = "TeacherScene";
export default TeacherScene;
