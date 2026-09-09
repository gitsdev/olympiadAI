import GithubSlugger from "github-slugger";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Extract h2/h3 headings from Markdown for the article's table of contents.
 * Uses the same slugger as `rehype-slug`, so the ids match the rendered
 * heading anchors exactly.
 */
export function buildToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (/^(```|~~~)/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;

    const level = m[1].length as 2 | 3;
    // strip inline markdown (links, emphasis, code) for the label
    const text = m[2]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    if (!text) continue;

    items.push({ id: slugger.slug(text), text, level });
  }

  return items;
}
