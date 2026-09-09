import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/blog-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "OlympiadIQ Blog";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const title = post?.title ?? "The OlympiadIQ Blog";
  const category = post?.category ?? "Olympiad Prep";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #1b2a6b 0%, #2f45b8 55%, #4256d0 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
          OlympiadIQ
          <span style={{ opacity: 0.6, fontWeight: 500, marginLeft: 14 }}>· {category}</span>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 80 ? 52 : 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.8 }}>
          Olympiad prep &amp; ICSE / CBSE study references
        </div>
      </div>
    ),
    size
  );
}
