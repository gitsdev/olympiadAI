import { CalendarClock, CheckCircle2, PencilLine, RefreshCw, Sunrise } from "lucide-react";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { EmptyState } from "@/components/admin/EmptyState";
import { formatZoned } from "@/lib/seo-agent/datetime";
import type { TomorrowArticle } from "@/lib/seo-agent/dashboard-data";
import { StatusBadge } from "./StatusBadge";

interface Props {
  article: TomorrowArticle | null;
  tomorrowDate: string; // YYYY-MM-DD in tz
  timezone: string;
}

// Action buttons are wired up as their phases land (editor: 4, approval +
// scheduling: 6). Until then they render disabled with an explanation.
const ACTIONS = [
  { label: "Edit Article", Icon: PencilLine, phase: 4 },
  { label: "Approve", Icon: CheckCircle2, phase: 6 },
  { label: "Regenerate", Icon: RefreshCw, phase: 4 },
  { label: "Schedule", Icon: CalendarClock, phase: 6 },
];

export function TomorrowArticleCard({ article, tomorrowDate, timezone }: Props) {
  const dateLabel = formatZoned(new Date(`${tomorrowDate}T12:00:00Z`), timezone, { dateOnly: true });

  return (
    <OACard>
      <OACardHeader>
        <OACardTitle>Tomorrow&apos;s article</OACardTitle>
        <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>{dateLabel}</span>
      </OACardHeader>

      {!article ? (
        <EmptyState
          Icon={Sunrise}
          title="Nothing planned for tomorrow yet"
          description="Once keywords and the content calendar are set up, the daily agent prepares a draft here for you to review."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] font-bold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
              {article.title}
            </h2>
            {article.primaryKeyword && (
              <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
                Primary keyword: <span className="font-medium" style={{ color: "var(--ink-700)" }}>{article.primaryKeyword}</span>
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[13px]">
            <div className="flex flex-col gap-1">
              <dt style={{ color: "var(--fg-muted)" }}>Status</dt>
              <dd><StatusBadge status={article.status} /></dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt style={{ color: "var(--fg-muted)" }} title="Internal content-quality score, not a Google ranking score">
                Content score
              </dt>
              <dd className="font-semibold" style={{ color: "var(--ink-900)" }}>
                {article.seoScore === null ? "Not checked" : `${article.seoScore}/100`}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt style={{ color: "var(--fg-muted)" }}>Publishes</dt>
              <dd style={{ color: "var(--ink-900)" }}>{article.publishAt ? formatZoned(article.publishAt, timezone) : "Not scheduled"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {ACTIONS.map(({ label, Icon, phase }) => (
              <button
                key={label}
                type="button"
                disabled
                title={`Available from build phase ${phase}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-md)] border text-[13px] font-semibold opacity-50 cursor-not-allowed"
                style={{ borderColor: "var(--line-300)", color: "var(--ink-700)" }}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </OACard>
  );
}
