// Labelled counts with proportional bars, for small categorical breakdowns.

export function BreakdownList({ items, emptyLabel = "No data in this period." }: { items: Array<{ label: string; count: number }>; emptyLabel?: string }) {
  if (items.length === 0) {
    return <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>{emptyLabel}</p>;
  }
  const total = items.reduce((s, i) => s + i.count, 0);
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.slice(0, 8).map((i) => (
        <li key={i.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[13px] gap-3">
            <span className="truncate" style={{ color: "var(--ink-900)" }}>{i.label}</span>
            <span className="tabular-nums shrink-0" style={{ color: "var(--fg-muted)" }}>
              {i.count} <span className="text-[11.5px]">({Math.round((i.count / total) * 100)}%)</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--fill-100)" }}>
            <div className="h-full rounded-full" style={{ width: `${(i.count / max) * 100}%`, background: "var(--cobalt-400)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
