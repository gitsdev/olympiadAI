/* AvatarProvider abstraction — swap any provider without touching lesson logic.
   Supported providers: HeyGen Live Avatar, OpenAI TTS (voice-only),
   Web Speech API (fallback). Future: Tavus, D-ID, Synthesia, Azure AI Avatar. */

export interface AvatarProvider {
  /** Unique identifier, e.g. "heygen" | "openai-voice" | "browser" */
  readonly id: string;
  /** Human-readable name shown in UI */
  readonly displayName: string;
  /** Whether this provider renders a visible video feed */
  readonly hasVideo: boolean;

  /**
   * Initialise the provider. For video providers, call this after the
   * video element is available in the DOM.
   */
  initialize(videoEl?: HTMLVideoElement | null): Promise<void>;

  /** Speak the given text. Calls onEnd when the avatar finishes speaking. */
  speak(text: string, rate: number, onEnd: () => void): void;

  /** Pause current speech. */
  pause(): void;

  /** Resume paused speech. */
  resume(): void;

  /** Interrupt and discard current speech. */
  stop(): void;

  /** Clean up WebRTC / audio resources on unmount. */
  destroy(): void;
}

/** Shape of the /api/avatar/capabilities response */
export interface AvatarCapabilities {
  /** "heygen" if HEYGEN_API_KEY is set, otherwise "none" */
  video: "heygen" | "none";
  /** "openai" if OPENAI_API_KEY is set, otherwise "browser" */
  voice: "openai" | "browser";
  /** HeyGen avatar ID (from HEYGEN_AVATAR_ID env or default public avatar) */
  avatarId: string;
  /** HeyGen voice ID (from HEYGEN_VOICE_ID env or default) */
  voiceId: string;
}
