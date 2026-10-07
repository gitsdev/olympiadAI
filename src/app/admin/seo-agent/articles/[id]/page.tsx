import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { getArticle } from "@/lib/seo-agent/articles-data";
import { EDITABLE_ARTICLE_STATUSES } from "@/lib/seo-agent/articles";
import { wordCount } from "@/lib/seo-agent/article-html";
import { formatZoned } from "@/lib/seo-agent/datetime";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { ArticleEditor } from "./ArticleEditor";

export const metadata: Metadata = { title: "Edit Article | SEO Agent", description: "Edit an SEO article." };
export const dynamic = "force-dynamic";
// Regenerate runs the Content Writer Agent (a full article) in a server action on this route.
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function load(id: string) {
  try {
    const [settings, article] = await Promise.all([getSeoSettings(), getArticle(id)]);
    return { settings, article };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function ArticlePage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await load(id);
  if (!data) return <SeoAgentShell title="Article"><SchemaMissingNotice /></SeoAgentShell>;
  const { settings, article } = data;
  if (!article) notFound();

  const plannedAt = article.plan?.plannedPublishAt;
  const subtitle = [
    `${wordCount(article.contentHtml).toLocaleString("en-IN")} words`,
    `version ${article.currentVersion}`,
    plannedAt ? `planned for ${formatZoned(plannedAt, settings.timezone)}` : null,
  ].filter(Boolean).join(" · ");

  // Remount the editor only when the body is replaced from outside (regenerate / restore),
  // not after the admin's own saves.
  const contentKey = article.versions.find((v) => v.source !== "MANUAL_EDIT")?.id ?? "initial";

  return (
    <SeoAgentShell title="Article" subtitle={subtitle} actions={<StatusBadge status={article.status} />}>
      {article.status === "GENERATING" ? (
        <p className="text-[14px]" style={{ color: "var(--fg-muted)" }}>The Content Writer is working on this article. Reload in a minute.</p>
      ) : (
        <ArticleEditor
          key={contentKey}
          article={article}
          editable={EDITABLE_ARTICLE_STATUSES.includes(article.status)}
          timezone={settings.timezone}
          blogBaseUrl={settings.blogBaseUrl}
          defaultCta={settings.defaultCta}
        />
      )}
    </SeoAgentShell>
  );
}
