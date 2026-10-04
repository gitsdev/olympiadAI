import { ExternalLink } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { SeoCompetitor } from "@/lib/admin/seo-data";

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ background: "var(--fill-200)" }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[12.5px] font-semibold tabular-nums w-[34px] text-right" style={{ color: "var(--ink-900)" }}>
        {value}
      </span>
    </div>
  );
}

function Row({ c, rank, highlight }: { c: SeoCompetitor; rank: string; highlight?: boolean }) {
  return (
    <TableRow style={highlight ? { background: "var(--cobalt-50)" } : undefined}>
      <TableCell className="tabular-nums font-semibold" style={{ color: "var(--fg-muted)" }}>{rank}</TableCell>
      <TableCell>
        <div className="font-semibold" style={{ color: "var(--ink-900)" }}>{c.name}</div>
        <a
          href={`https://${c.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] hover:underline"
          style={{ color: "var(--fg-subtle)" }}
        >
          {c.domain} <ExternalLink size={11} />
        </a>
      </TableCell>
      <TableCell><ScoreBar value={c.seoScore} color="var(--cobalt-500)" /></TableCell>
      <TableCell><ScoreBar value={c.visibility} color="var(--gold-500)" /></TableCell>
      <TableCell className="text-[12.5px] max-w-[260px] whitespace-normal">{c.strengths}</TableCell>
      <TableCell className="text-[12.5px] max-w-[260px] whitespace-normal" style={{ color: "var(--cobalt-700)" }}>{c.gap}</TableCell>
    </TableRow>
  );
}

export function CompetitorTable({ competitors, ours }: { competitors: SeoCompetitor[]; ours: SeoCompetitor }) {
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">#</TableHead>
            <TableHead>Competitor</TableHead>
            <TableHead>SEO score</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Where they win</TableHead>
            <TableHead>Our opening</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {competitors.map((c, i) => <Row key={c.domain} c={c} rank={String(i + 1)} />)}
          <Row c={ours} rank="—" highlight />
        </TableBody>
      </Table>
      <p className="text-[11.5px] px-1" style={{ color: "var(--fg-subtle)" }}>
        SEO score is the site&apos;s estimated domain authority (0–100). Visibility is the estimated share of the
        tracked keywords below where the site ranks in Google&apos;s top 10.
      </p>
    </div>
  );
}
