import "server-only";

// Branded cover image for SEO articles: 1200×630 PNG (the Open Graph size),
// rendered on the server with next/og. Free and deterministic, so every
// published post has at least one picture without an image API.

import { ImageResponse } from "next/og";

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;

// public/assets/logo-mark.svg, inlined so the renderer doesn't depend on
// reading files from the deployment.
const LOGO_SVG = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="15" fill="#2B4DD6"/><rect x="0.5" y="0.5" width="63" height="63" rx="14.5" stroke="#ffffff" stroke-opacity="0.10"/><g stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.55"><line x1="19" y1="45" x2="31.5" y2="33.5"/><line x1="31.5" y1="33.5" x2="45" y2="20"/><line x1="31.5" y1="33.5" x2="43.5" y2="44"/></g><circle cx="19" cy="45" r="5" fill="#ffffff"/><circle cx="31.5" cy="33.5" r="5" fill="#ffffff"/><circle cx="43.5" cy="44" r="4.2" fill="#ffffff" fill-opacity="0.78"/><circle cx="45" cy="20" r="6" fill="#EFB141"/></svg>`;
const LOGO_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

const BRAND = { deep: "#16245E", blue: "#2B4DD6", bright: "#4A6CF2", gold: "#EFB141", ink: "#1E2433" };

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
        {/* Decorative network, echoing the logo mark */}
        <div style={{ position: "absolute", right: -120, top: -120, width: 460, height: 460, borderRadius: 9999, border: "2px solid rgba(255,255,255,0.10)", display: "flex" }} />
        <div style={{ position: "absolute", right: 40, bottom: -160, width: 380, height: 380, borderRadius: 9999, background: "rgba(255,255,255,0.05)", display: "flex" }} />
        <div style={{ position: "absolute", right: 150, top: 110, width: 30, height: 30, borderRadius: 9999, background: BRAND.gold, display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
            <img src={LOGO_URI} width={58} height={58} alt="" style={{ borderRadius: 14 }} />
            <span style={{ fontSize: 34, letterSpacing: -0.5 }}>OlympiadIQ</span>
          </div>
          {input.category && (
            <span style={{ display: "flex", fontSize: 24, padding: "8px 20px", borderRadius: 9999, background: BRAND.gold, color: BRAND.ink }}>
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
