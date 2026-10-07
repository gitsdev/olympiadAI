"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError, inputCls, inputStyle } from "@/components/seo-agent/FormField";
import { createKeyword, updateKeyword } from "@/actions/seo-agent/keywords";
import { KEYWORD_STATUSES, SEARCH_INTENTS, humanizeStatus } from "@/lib/seo-agent/constants";
import { KEYWORD_PRIORITIES, KEYWORD_SUBJECTS } from "@/lib/seo-agent/keywords";
import type { KeywordRow } from "@/lib/seo-agent/keywords-data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this keyword; omit to add a new one. */
  keyword?: KeywordRow | null;
}

const empty = { keyword: "", searchIntent: "", targetClass: "", subject: "", priority: "MEDIUM", status: "ACTIVE", notes: "" };

function fromRow(k: KeywordRow) {
  return {
    keyword: k.keyword,
    searchIntent: k.search_intent ?? "",
    targetClass: k.target_class ? String(k.target_class) : "",
    subject: k.subject ?? "",
    priority: k.priority,
    status: k.status,
    notes: k.notes ?? "",
  };
}

export function KeywordFormDialog({ open, onOpenChange, keyword }: Props) {
  const router = useRouter();
  // Remount-free reset: initialise from props whenever the dialog opens.
  const [values, setValues] = useState(keyword ? fromRow(keyword) : empty);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = open ? (keyword?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setValues(keyword ? fromRow(keyword) : empty);
      setError(null);
    }
  }

  const set = (k: keyof typeof empty, v: string) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const payload = {
      keyword: values.keyword,
      searchIntent: values.searchIntent || null,
      targetClass: values.targetClass ? Number(values.targetClass) : null,
      subject: values.subject,
      priority: values.priority,
      status: values.status,
      notes: values.notes,
    };
    const res = keyword ? await updateKeyword(keyword.id, payload) : await createKeyword(payload);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{keyword ? "Edit keyword" : "Add keyword"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <Field label="Keyword">
            <input autoFocus required className={inputCls} style={inputStyle} value={values.keyword}
              placeholder="maths olympiad class 5" onChange={(e) => set("keyword", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target class">
              <select className={inputCls} style={inputStyle} value={values.targetClass} onChange={(e) => set("targetClass", e.target.value)}>
                <option value="">Any</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <input className={inputCls} style={inputStyle} list="seo-keyword-subjects" value={values.subject}
                onChange={(e) => set("subject", e.target.value)} />
              <datalist id="seo-keyword-subjects">
                {KEYWORD_SUBJECTS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label="Search intent" hint="Leave blank to let the agent decide.">
              <select className={inputCls} style={inputStyle} value={values.searchIntent} onChange={(e) => set("searchIntent", e.target.value)}>
                <option value="">Not set</option>
                {SEARCH_INTENTS.map((i) => <option key={i} value={i}>{humanizeStatus(i)}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className={inputCls} style={inputStyle} value={values.priority} onChange={(e) => set("priority", e.target.value)}>
                {KEYWORD_PRIORITIES.map((p) => <option key={p} value={p}>{humanizeStatus(p)}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} style={inputStyle} value={values.status} onChange={(e) => set("status", e.target.value)}>
                {KEYWORD_STATUSES.map((s) => <option key={s} value={s}>{humanizeStatus(s)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputCls} style={inputStyle} rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : keyword ? "Save" : "Add keyword"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
