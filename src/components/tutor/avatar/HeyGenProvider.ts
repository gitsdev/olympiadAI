import type { AvatarProvider } from "./types";

/* HeyGen Live Avatar provider — photorealistic AI presenter with WebRTC streaming.
   Requires HEYGEN_API_KEY + HEYGEN_AVATAR_ID in .env (server-side).
   Client fetches a session token from /api/avatar/heygen-token, then
   initialises the LiveAvatarSession SDK which handles WebRTC internally. */

export class HeyGenProvider implements AvatarProvider {
  readonly id          = "heygen";
  readonly displayName = "HeyGen Live Avatar";
  readonly hasVideo    = true;

  private session:      InstanceType<typeof import("@heygen/liveavatar-web-sdk").LiveAvatarSession> | null = null;
  private videoEl:      HTMLVideoElement | null = null;
  private onEndCurrent: (() => void) | null = null;
  private destroyed     = false;

  /* ── initialize ── */
  async initialize(videoEl?: HTMLVideoElement | null): Promise<void> {
    this.videoEl = videoEl ?? null;

    // Fetch a short-lived session token from our server proxy
    const tokenRes = await fetch("/api/avatar/heygen-token");
    if (!tokenRes.ok) {
      throw new Error(`[HeyGen] Failed to get session token (${tokenRes.status}). Check HEYGEN_API_KEY.`);
    }
    const { token } = await tokenRes.json() as { token: string };

    // Dynamically import the SDK (client-only, avoids SSR issues)
    const { LiveAvatarSession, AgentEventsEnum, SessionEvent } = await import("@heygen/liveavatar-web-sdk");

    this.session = new LiveAvatarSession(token, { voiceChat: false });

    // When stream is ready, attach it to the video element
    this.session.on(SessionEvent.SESSION_STREAM_READY, () => {
      if (this.videoEl && this.session) {
        this.session.attach(this.videoEl);
      }
    });

    // When avatar finishes speaking, call the registered onEnd callback
    this.session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      const cb = this.onEndCurrent;
      this.onEndCurrent = null;
      cb?.();
    });

    // Establish WebRTC connection
    await this.session.start();
  }

  /* ── speak ── */
  speak(text: string, _rate: number, onEnd: () => void): void {
    if (!this.session || this.destroyed) { onEnd(); return; }
    this.onEndCurrent = onEnd;
    try {
      this.session.repeat(text); // fires AVATAR_SPEAK_ENDED when done
    } catch (err) {
      console.error("[HeyGen] speak error:", err);
      this.onEndCurrent = null;
      onEnd();
    }
  }

  /* ── pause ── */
  pause(): void {
    if (this.session) {
      try { this.session.interrupt(); } catch { /* ignore */ }
    }
    const cb = this.onEndCurrent;
    this.onEndCurrent = null;
    cb?.(); // resolve any pending speak so engine can pause cleanly
  }

  /* ── resume: re-speak is handled by the engine which replays the slide ── */
  resume(): void { /* engine calls speak() again after resume */ }

  /* ── stop ── */
  stop(): void {
    this.onEndCurrent = null;
    if (this.session) {
      try { this.session.interrupt(); } catch { /* ignore */ }
    }
  }

  /* ── destroy ── */
  destroy(): void {
    this.destroyed = true;
    this.onEndCurrent = null;
    if (this.session) {
      this.session.stop().catch(() => {});
      this.session = null;
    }
  }
}
