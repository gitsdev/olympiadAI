"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import type { ProspectRow } from "@/lib/seo-agent/backlinks/data";
import { ProspectFormDialog } from "./ProspectFormDialog";

function Score({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "var(--fg-subtle)" }}>—</span>;
  const color = value >= 70 ? "var(--success-tx)" : value >= 40 ? "var(--warning-tx)" : "var(--danger-tx)";
  return <span className="font-semibold tabular-nums" style={{ color }}>{value}</span>;
}

export function ProspectsTable({ rows }: { rows: ProspectRow[] }) {
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setFormKey((k) => k + 1); setAdding(true); }}><Plus size={14} /> Add opportunity</Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState Icon={Link2} title="No backlink opportunities yet"
          description="Add relevant education sites (resource pages, teacher or parenting blogs, school directories) one at a time. The agent never scrapes or contacts sites in bulk." />
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-[13px] min-w-[820px]">
            <thead>
              <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)" }}>
                <th className="py-2 pr-3 font-medium">Website</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium text-right" title="0–100, from the page's actual content">Relevance</th>
                <th className="py-2 pr-3 font-medium text-right">Quality</th>
                <th className="py-2 pr-3 font-medium">Spam risk</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-200)]">
              {rows.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="py-2.5 pr-3">
                    <Link href={`/admin/seo-agent/backlinks/${p.id}`} className="font-semibold hover:underline" style={{ color: "var(--ink-900)" }}>{p.website}</Link>
                    <span className="block text-[12px] truncate max-w-[280px]" style={{ color: "var(--fg-muted)" }}>{p.topic ?? p.url}</span>
                  </td>
                  <td className="py-2.5 pr-3" style={{ color: "var(--ink-700)" }}>{humanizeStatus(p.opportunityType)}</td>
                  <td className="py-2.5 pr-3 text-right"><Score value={p.relevanceScore} /></td>
                  <td className="py-2.5 pr-3 text-right"><Score value={p.qualityScore} /></td>
                  <td className="py-2.5 pr-3">{p.evaluated ? <StatusBadge status={p.spamRisk} /> : <span style={{ color: "var(--fg-subtle)" }}>Not evaluated</span>}</td>
                  <td className="py-2.5 pr-3"><StatusBadge status={p.status} /></td>
                  <td className="py-2.5 truncate max-w-[200px]" style={{ color: "var(--ink-700)" }}>{p.contactEmail ?? p.contactName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ProspectFormDialog key={formKey} open={adding} onOpenChange={setAdding} />
    </div>
  );
}
