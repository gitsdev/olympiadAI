import type { CSSProperties } from "react";

interface DiamondMotifProps {
  /** "light" for pale backgrounds, "dark" for cobalt/ink backgrounds */
  tone?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
}

/**
 * Decorative outline of the logo mark (nested diamonds, centre dot and the
 * orange accent dot). Purely ornamental: size and place it with className.
 */
export function DiamondMotif({ tone = "light", className, style }: DiamondMotifProps) {
  const line = tone === "dark" ? "#FFFFFF" : "#2563EB";
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
      className={className}
      style={{ pointerEvents: "none", ...style }}
    >
      <path d="M32 11 L50 32 L32 53 L14 32 Z" fill={line} fillOpacity={tone === "dark" ? 0.05 : 0.04} stroke={line} strokeOpacity={tone === "dark" ? 0.18 : 0.16} strokeWidth={0.4} strokeLinejoin="round" />
      <path d="M32 19.6 L41 32 L32 44.4 L23 32 Z" stroke={line} strokeOpacity={tone === "dark" ? 0.22 : 0.2} strokeWidth={0.4} strokeLinejoin="round" />
      <circle cx="32" cy="32" r="3" fill={line} fillOpacity={tone === "dark" ? 0.2 : 0.16} />
      <circle cx="50" cy="16" r="2.2" fill="#F59E0B" fillOpacity={0.9} />
    </svg>
  );
}
