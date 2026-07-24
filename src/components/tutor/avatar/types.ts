export interface AvatarProvider {
  readonly id:          string;
  readonly displayName: string;

  initialize(videoEl?: HTMLVideoElement | null): Promise<void>;
  speak(text: string, rate: number, onEnd: () => void): void;
  pause():   void;
  resume():  void;
  stop():    void;
  destroy(): void;
}

/** Shape of the /api/avatar/capabilities response */
export interface AvatarCapabilities {
  /** "openai" if OPENAI_API_KEY is set, otherwise "browser" */
  voice: "openai" | "browser";
}
