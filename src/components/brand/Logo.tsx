import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Icon size in px */
  size?: number;
  /** Show the wordmark next to the icon */
  showWordmark?: boolean;
  /** Show the "Olympiad Excellence" tagline under the wordmark */
  showTagline?: boolean;
  /** Light wordmark for dark/inverted backgrounds (e.g. the footer) */
  mono?: boolean;
  className?: string;
}

export function Logo({
  size = 32,
  showWordmark = true,
  showTagline = false,
  mono = false,
  className,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* The mark has its own light tile, so it reads on light and dark backgrounds alike. */}
      <Image
        src="/assets/logo-mark.svg"
        alt="OlympiadIQ"
        width={size}
        height={size}
        style={{ flexShrink: 0 }}
        priority
      />
      {showWordmark && (
        <span className="flex flex-col" style={{ gap: showTagline ? size * 0.08 : 0 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: showTagline ? size * 0.62 : size * 0.75,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              // An inline color can't be beaten by an external className, so
              // the light/dark choice has to live inside the component.
              color: mono ? "#fff" : "var(--fg)",
            }}
          >
            Olympiad
            <span style={{ color: mono ? "oklch(0.72 0.14 259)" : "var(--brand)" }}>IQ</span>
          </span>
          {showTagline && (
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: Math.max(9, size * 0.2),
                letterSpacing: "0.16em",
                lineHeight: 1,
                color: mono ? "oklch(1 0 0 / 0.6)" : "var(--fg-muted)",
              }}
            >
              Olympiad Excellence
            </span>
          )}
        </span>
      )}
    </div>
  );
}
