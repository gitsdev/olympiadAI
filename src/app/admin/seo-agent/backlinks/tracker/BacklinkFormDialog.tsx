"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError, inputCls, inputStyle } from "@/components/seo-agent/FormField";
import { createBacklink, updateBacklink } from "@/actions/seo-agent/backlinks";
import { BACKLINK_STATUSES } from "@/lib/seo-agent/backlinks/model";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import type { BacklinkRow } from "@/lib/seo-agent/backlinks/data";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  backlink?: BacklinkRow;
  /** Prefill when adding from a prospect. */
  defaults?: { sourceUrl?: string; targetUrl?: string; prospectId?: string };
}

/** Add or edit a tracked backlink. Remount (key) to reset. */
export function BacklinkFormDialog({ open, onOpenChange, backlink, defaults }: Props) {
  const router = useRouter();
  const [v, setV] = useState({
    sourceUrl: backlink?.sourceUrl ?? defaults?.sourceUrl ?? "",
    targetUrl: backlink?.targetUrl ?? defaults?.targetUrl ?? "https://www.olympiadiq.in/",
    anchorText: backlink?.anchorText ?? "",
    status: backlink?.status ?? "PUBLISHED",
    notes: backlink?.notes ?? "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = backlink ? await updateBacklink(backlink.id, v) : await createBacklink(v, defaults?.prospectId);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{backlink ? "Edit backlink" : "Track a backlink"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Source URL" hint="The page on their site that links (or should link) to us.">
            <input autoFocus required className={inputCls} style={inputStyle} value={v.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} />
          </Field>
          <Field label="Target URL" hint="The OlympiadIQ page they link to.">
            <input required className={inputCls} style={inputStyle} value={v.targetUrl} onChange={(e) => set("targetUrl", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Anchor text" hint="Filled in automatically when found.">
              <input className={inputCls} style={inputStyle} value={v.anchorText} onChange={(e) => set("anchorText", e.target.value)} />
            </Field>
            <Field label="Status">
              <select className={inputCls} style={inputStyle} value={v.status} onChange={(e) => set("status", e.target.value)}>
                {BACKLINK_STATUSES.map((s) => <option key={s} value={s}>{humanizeStatus(s)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputCls} style={inputStyle} rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : backlink ? "Save" : "Track"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
