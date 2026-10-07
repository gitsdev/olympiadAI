import {
  LayoutDashboard, KeyRound, Network, Lightbulb, LineChart, CalendarDays, FileText,
  FilePen, FileCheck2, Link2, Send, Activity, Bot, Coins, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SEO_AGENT_BASE = "/admin/seo-agent";

export interface SeoNavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Build phase that delivers this page; items without one are live. */
  comingInPhase?: number;
}

export interface SeoNavGroup {
  label?: string;
  items: SeoNavItem[];
}

// Pages are added here as each MVP phase lands — flip `comingInPhase` off
// once the route exists.
export const SEO_NAV: SeoNavGroup[] = [
  { items: [{ href: `${SEO_AGENT_BASE}/dashboard`, label: "Dashboard", Icon: LayoutDashboard }] },
  {
    label: "SEO",
    items: [
      { href: `${SEO_AGENT_BASE}/keywords`, label: "Keywords", Icon: KeyRound },
      { href: `${SEO_AGENT_BASE}/clusters`, label: "Keyword Clusters", Icon: Network },
      { href: `${SEO_AGENT_BASE}/opportunities`, label: "Content Opportunities", Icon: Lightbulb },
      { href: `${SEO_AGENT_BASE}/performance`, label: "SEO Performance", Icon: LineChart, comingInPhase: 9 },
    ],
  },
  {
    label: "Content",
    items: [
      { href: `${SEO_AGENT_BASE}/calendar`, label: "Content Calendar", Icon: CalendarDays },
      { href: `${SEO_AGENT_BASE}/articles`, label: "Articles", Icon: FileText, comingInPhase: 4 },
      { href: `${SEO_AGENT_BASE}/articles?status=DRAFT`, label: "Drafts", Icon: FilePen, comingInPhase: 4 },
      { href: `${SEO_AGENT_BASE}/articles?status=PUBLISHED`, label: "Published", Icon: FileCheck2, comingInPhase: 4 },
    ],
  },
  {
    label: "Backlinks",
    items: [
      { href: `${SEO_AGENT_BASE}/backlinks`, label: "Opportunities", Icon: Link2, comingInPhase: 10 },
      { href: `${SEO_AGENT_BASE}/backlinks/outreach`, label: "Outreach", Icon: Send, comingInPhase: 10 },
      { href: `${SEO_AGENT_BASE}/backlinks/tracker`, label: "Backlink Tracker", Icon: Activity, comingInPhase: 10 },
    ],
  },
  {
    label: "AI",
    items: [
      { href: `${SEO_AGENT_BASE}/agent-tasks`, label: "Agent Tasks", Icon: Bot },
      { href: `${SEO_AGENT_BASE}/ai-usage`, label: "AI Usage", Icon: Coins },
    ],
  },
  { items: [{ href: `${SEO_AGENT_BASE}/settings`, label: "Settings", Icon: Settings }] },
];
