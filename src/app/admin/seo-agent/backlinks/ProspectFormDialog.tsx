"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError, inputCls, inputStyle } from "@/components/seo-agent/FormField";
import { createProspect, updateProspect } from "@/actions/seo-agent/backlinks";
import { BACKLINK_STATUSES, OPPORTUNITY_TYPES } from "@/lib/seo-agent/backlinks/model";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import type { ProspectRow } from "@/lib/seo-agent/backlinks/data";

const empty = { url: "", website: "", topic: "", opportunityType: "OTHER", contactName: "", contactEmail: "", contactUrl: "", status: "PROSPECT", notes: "" };

function fromRow(p: ProspectRow) {
  return {
    url: p.url, website: p.website, topic: p.topic ?? "", opportunityType: p.opportunityType, contactName: p.contactName ?? "",
    contactEmail: p.contactEmail ?? "", contactUrl: p.contactUrl ?? "", status: p.status, notes: p.notes ?? "",
  };
}

/** Add or edit a backlink opportunity. Remount (key) to reset between prospects. */
export function ProspectFormDialog({ open, onOpenChange, prospect }: { open: boolean; onOpenChange: (o: boolean) => void; prospect?: ProspectRow }) {
  const router = useRouter();
  const [v, setV] = useState(prospect ? fromRow(prospect) : empty);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof empty, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = prospect ? await updateProspect(prospect.id, v) : await createProspect(v);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onOpenChange(false);
    if (!prospect && "id" in res) router.push(`/admin/seo-agent/backlinks/${res.id}`);
    else router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{prospect ? "Edit opportunity" : "Add backlink opportunity"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Page URL" hint="The page where a link to OlympiadIQ could fit (e.g. a resources page).">
            <input autoFocus required className={inputCls} style={inputStyle} value={v.url} placeholder="https://example.org/resources" onChange={(e) => set("url", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Website name" hint="Leave blank to use the domain.">
              <input className={inputCls} style={inputStyle} value={v.website} onChange={(e) => set("website", e.target.value)} />
            </Field>
            <Field label="Topic">
              <input className={inputCls} style={inputStyle} value={v.topic} placeholder="e.g. maths learning for kids" onChange={(e) => set("topic", e.target.value)} />
            </Field>
            <Field label="Opportunity type">
              <select className={inputCls} style={inputStyle} value={v.opportunityType} onChange={(e) => set("opportunityType", e.target.value)}>
                {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{humanizeStatus(t)}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} style={inputStyle} value={v.status} onChange={(e) => set("status", e.target.value)}>
                {BACKLINK_STATUSES.map((s) => <option key={s} value={s}>{humanizeStatus(s)}</option>)}
              </select>
            </Field>
            <Field label="Contact name">
              <input className={inputCls} style={inputStyle} value={v.contactName} onChange={(e) => set("contactName", e.target.value)} />
            </Field>
            <Field label="Contact email">
              <input type="email" className={inputCls} style={inputStyle} value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
            </Field>
          </div>
          <Field label="Contact page URL">
            <input className={inputCls} style={inputStyle} value={v.contactUrl} onChange={(e) => set("contactUrl", e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} style={inputStyle} rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : prospect ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
