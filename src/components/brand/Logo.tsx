import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Icon size in px */
  size?: number;
  /** Show the wordmark next to the icon */
  showWordmark?: boolean;
  /** Mono version (currentColor fill, no gold) */
  mono?: boolean;
  className?: string;
}

export function Logo({
  size = 32,
  showWordmark = true,
  mono = false,
  className,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src={mono ? "/assets/logo-mark-mono.svg" : "/assets/logo-mark.svg"}
        alt="OlympiadAI"
        width={size}
        height={size}
        style={{ borderRadius: Math.round(size * 0.234), flexShrink: 0 }}
        priority
      />
      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: size * 0.75,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: "var(--fg)",
          }}
        >
          Olympiad
          <span style={{ color: "var(--brand)" }}>AI</span>
        </span>
      )}
    </div>
  );
}
