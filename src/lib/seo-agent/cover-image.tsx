import "server-only";

// Branded cover image for SEO articles: 1200×630 PNG (the Open Graph size),
// rendered on the server with next/og. Free and deterministic, so every
// published post has at least one picture without an image API.

import { ImageResponse } from "next/og";

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;

// public/assets/logo-mark.svg, inlined so the renderer doesn't depend on
// reading files from the deployment.
const LOGO_SVG = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="oiq-diamond" x1="14" y1="11" x2="50" y2="53" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs><rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="#EFF5FF" stroke="#E4ECFB"/><path d="M32 11 L50 32 L32 53 L14 32 Z" fill="url(#oiq-diamond)"/><path d="M32 19.6 L41 32 L32 44.4 L23 32 Z" fill="#DCE8FD"/><circle cx="32" cy="32" r="4.5" fill="#2563EB"/><circle cx="50" cy="16" r="3.6" fill="#F59E0B"/></svg>`;
const LOGO_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

// Colours taken from the logo mark.
const BRAND = { deep: "#172554", blue: "#1D4ED8", bright: "#3B82F6", accent: "#F59E0B", ink: "#1E2433" };

// Large outline of the logo's diamond, drawn behind the title.
const MOTIF_SVG = `<svg width="640" height="640" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M32 11 L50 32 L32 53 L14 32 Z" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.16" stroke-width="0.35" stroke-linejoin="round"/><path d="M32 19.6 L41 32 L32 44.4 L23 32 Z" stroke="#ffffff" stroke-opacity="0.2" stroke-width="0.35" stroke-linejoin="round"/><circle cx="32" cy="32" r="3" fill="#ffffff" fill-opacity="0.16"/><circle cx="50" cy="17" r="2" fill="${BRAND.accent}"/></svg>`;
const MOTIF_URI = `data:image/svg+xml;base64,${Buffer.from(MOTIF_SVG).toString("base64")}`;

export interface CoverInput {
  title: string;
  category: string | null;
  targetClass: number | null;
  subject: string | null;
}

/** Longer titles get smaller type so they fit in three lines. */
export function coverTitleSize(title: string): number {
  const n = title.length;
  if (n <= 36) return 76;
  if (n <= 60) return 64;
  if (n <= 85) return 54;
  return 46;
}

export function coverTitle(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  return t.length > 110 ? `${t.slice(0, 107).trimEnd()}…` : t;
}

export function coverAltText(input: Pick<CoverInput, "title">): string {
  return `${coverTitle(input.title)}: OlympiadIQ blog cover`;
}

export function coverChips(input: CoverInput): string[] {
  return [input.targetClass ? `Class ${input.targetClass}` : null, input.subject].filter((c): c is string => Boolean(c));
}

/** Renders the cover and returns PNG bytes. */
export async function renderCoverImage(input: CoverInput): Promise<Uint8Array> {
  const title = coverTitle(input.title);
  const chips = coverChips(input);
  const res = new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "56px 64px", color: "white", position: "relative",
        backgroundImage: `linear-gradient(135deg, ${BRAND.deep} 0%, ${BRAND.blue} 58%, ${BRAND.bright} 100%)`,
      }}>
        {/* Decorative diamond, echoing the logo mark */}
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
        <img src={MOTIF_URI} width={640} height={640} alt="" style={{ position: "absolute", right: -110, top: 0 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
            <img src={LOGO_URI} width={58} height={58} alt="" style={{ borderRadius: 14 }} />
            <span style={{ fontSize: 34, letterSpacing: -0.5 }}>OlympiadIQ</span>
          </div>
          {input.category && (
            <span style={{ display: "flex", fontSize: 24, padding: "8px 20px", borderRadius: 9999, background: BRAND.accent, color: BRAND.ink }}>
              {input.category}
            </span>
          )}
        </div>

        <div style={{ display: "flex", fontSize: coverTitleSize(title), lineHeight: 1.12, letterSpacing: -1.5, maxWidth: 1000 }}>
          {title}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {chips.map((c) => (
              <span key={c} style={{ display: "flex", fontSize: 24, padding: "8px 18px", borderRadius: 12, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)" }}>
                {c}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 24, opacity: 0.85 }}>olympiadiq.in/blog</span>
        </div>
      </div>
    ),
    { width: COVER_WIDTH, height: COVER_HEIGHT },
  );
  if (!res.ok) throw new Error(`Cover image render failed (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
