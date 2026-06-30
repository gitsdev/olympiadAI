import * as React from "react";
import { cn } from "@/lib/utils";

type AvatarTone = "cobalt" | "gold";

const TONE_STYLES: Record<AvatarTone, { bg: string; fg: string }> = {
  cobalt: { bg: "var(--cobalt-100)", fg: "var(--cobalt-700)" },
  gold:   { bg: "var(--gold-100)",   fg: "var(--gold-700)" },
};

interface OAAvatarProps {
  name: string;
  size?: number;
  tone?: AvatarTone;
  className?: string;
}

function OAAvatar({ name, size = 36, tone = "cobalt", className }: OAAvatarProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const { bg, fg } = TONE_STYLES[tone];

  return (
    <div
      className={cn("flex items-center justify-center rounded-full font-bold shrink-0", className)}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontFamily: "var(--font-display)",
        fontSize: size * 0.42,
      }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

export { OAAvatar };
export type { AvatarTone };
