"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postAdmin } from "./actions";
import { fmtDateTime } from "./format";

export interface PricingRow {
  feature_key: string;
  feature_name: string;
  credit_cost: number | null;
  is_enabled: boolean;
  updated_at: string;
  updated_by_name: string | null;
}

export function PricingEditor({ rows, canEdit }: { rows: PricingRow[]; canEdit: boolean }) {
  return (
    <div className="rounded-[var(--r-lg)] border overflow-x-auto" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
      <table className="w-full text-[13.5px] min-w-[760px]">
        <thead>
          <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)", background: "var(--paper-2)" }}>
            <th className="px-4 py-2.5 font-semibold">Feature</th>
            <th className="px-4 py-2.5 font-semibold">Key</th>
            <th className="px-4 py-2.5 font-semibold">Credits per start</th>
            <th className="px-4 py-2.5 font-semibold">Charging</th>
            <th className="px-4 py-2.5 font-semibold">Last updated</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <PricingRowEditor key={r.feature_key} row={r} canEdit={canEdit} />)}
        </tbody>
      </table>
    </div>
  );
}

function PricingRowEditor({ row, canEdit }: { row: PricingRow; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(row.feature_name);
  const [cost, setCost] = useState(row.credit_cost === null ? "" : String(row.credit_cost));
  const [enabled, setEnabled] = useState(row.is_enabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsedCost = cost.trim() === "" ? null : Number(cost);
  const dirty = name !== row.feature_name || parsedCost !== row.credit_cost || enabled !== row.is_enabled;
  const costInvalid = parsedCost !== null && (!Number.isInteger(parsedCost) || parsedCost < 0);

  async function save() {
    setPending(true);
    setError(null);
    try {
      await postAdmin("/api/admin/credits/pricing", {
        featureKey: row.feature_key, featureName: name.trim(), creditCost: parsedCost, isEnabled: enabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <tr className="border-t align-top" style={{ borderColor: "var(--line-200)" }}>
      <td className="px-4 py-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={80} aria-label={`${row.feature_key} name`} />
        {error && <p className="text-[12px] mt-1.5" style={{ color: "var(--danger-tx)" }}>{error}</p>}
      </td>
      <td className="px-4 py-3 pt-5">
        <code className="text-[12px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>{row.feature_key}</code>
      </td>
      <td className="px-4 py-3">
        <Input
          inputMode="numeric" placeholder="Not set" value={cost} disabled={!canEdit}
          onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
          aria-label={`${row.feature_name} credit cost`} aria-invalid={costInvalid} className="w-28"
        />
      </td>
      <td className="px-4 py-3 pt-4">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox" checked={enabled} disabled={!canEdit}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-[var(--cobalt-500)]"
          />
          <span className="text-[13px]" style={{ color: enabled ? "var(--success-tx)" : "var(--fg-muted)" }}>
            {enabled ? "Charging" : "Free"}
          </span>
        </label>
        {enabled && !(parsedCost && parsedCost > 0) && (
          <p className="text-[11.5px] mt-1" style={{ color: "var(--warning-tx)" }}>Set a cost above 0 first.</p>
        )}
      </td>
      <td className="px-4 py-3 pt-4 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
        {fmtDateTime(row.updated_at)}
        <br />
        {row.updated_by_name ? `by ${row.updated_by_name}` : "never edited"}
      </td>
      <td className="px-4 py-3 text-right">
        {canEdit && (
          <Button size="sm" onClick={save} disabled={!dirty || pending || costInvalid || !name.trim() || (enabled && !(parsedCost && parsedCost > 0))}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? "Saved" : "Save"}
          </Button>
        )}
      </td>
    </tr>
  );
}
