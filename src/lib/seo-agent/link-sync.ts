// Planning for seo_article_links updates. Pure, so the rules are unit-tested.
//
// Rows have a status:
//   INSERTED  - the link is in the article body (rebuilt from the body on every save)
//   SUGGESTED - proposed by the planner or Internal Linking Agent, not applied yet
//   REJECTED  - the admin dismissed a suggestion; never re-suggested
//   ACCEPTED  - reserved

export interface ExistingLinkRow {
  id: string;
  target_url: string;
  status: string;
  reason: string | null;
}

export interface BodyLink {
  href: string;
  text: string;
}

export interface Suggestion {
  url: string;
  anchorText: string;
  reason: string;
}

export interface LinkSyncPlan {
  /** Row ids to delete: old INSERTED rows, and suggestions now applied in the body. */
  deleteIds: string[];
  insertInserted: { url: string; anchorText: string; reason: string | null }[];
  insertSuggested: Suggestion[];
}

export function planLinkSync(existing: ExistingLinkRow[], body: BodyLink[], newSuggestions: Suggestion[] = []): LinkSyncPlan {
  const bodyUrls = new Set(body.map((l) => l.href));
  const reasonFor = (url: string) =>
    existing.find((r) => r.target_url === url && r.reason)?.reason ?? newSuggestions.find((s) => s.url === url)?.reason ?? null;

  const deleteIds = existing
    .filter((r) => r.status === "INSERTED" || (r.status === "SUGGESTED" && bodyUrls.has(r.target_url)))
    .map((r) => r.id);

  // One INSERTED row per URL in the body.
  const insertInserted: LinkSyncPlan["insertInserted"] = [];
  const seen = new Set<string>();
  for (const l of body) {
    if (seen.has(l.href)) continue;
    seen.add(l.href);
    insertInserted.push({ url: l.href, anchorText: l.text || l.href, reason: reasonFor(l.href) });
  }

  // New suggestions: not in the body, and not already known in any status
  // (so a dismissed suggestion is never re-suggested).
  const known = new Set(existing.filter((r) => r.status !== "INSERTED").map((r) => r.target_url));
  const insertSuggested: Suggestion[] = [];
  for (const s of newSuggestions) {
    if (bodyUrls.has(s.url) || known.has(s.url)) continue;
    known.add(s.url);
    insertSuggested.push(s);
  }

  return { deleteIds, insertInserted, insertSuggested };
}
