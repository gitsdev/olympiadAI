import { SITE_URL } from "@/lib/blog";
import { getPublishedPosts } from "@/lib/blog-data";

export const revalidate = 3600;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getPublishedPosts();
  const updated = posts[0]?.published_at ?? new Date().toISOString();

  const items = posts
    .map((p) => {
      const link = `${SITE_URL}/blog/${p.slug}`;
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <category>${escapeXml(p.category)}</category>
      <pubDate>${p.published_at ? new Date(p.published_at).toUTCString() : ""}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The OlympiadIQ Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Olympiad prep and ICSE/CBSE study references for students and parents.</description>
    <language>en-in</language>
    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
