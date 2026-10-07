"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormError, inputCls, inputStyle } from "@/components/seo-agent/FormField";
import { importKeywords, type ImportSummary } from "@/actions/seo-agent/keywords";

const CSV_EXAMPLE = `keyword,target_class,subject,priority,search_intent,notes
maths olympiad class 5,5,Mathematics,HIGH,INFORMATIONAL,
imo sample paper class 3,3,Mathematics,MEDIUM,,`;

export function ImportKeywordsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"lines" | "csv">("lines");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) { setText(""); setError(null); setSummary(null); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { setError("File is larger than 500 KB."); return; }
    setFormat("csv");
    setText(await file.text());
  }

  async function submit() {
    setPending(true);
    setError(null);
    setSummary(null);
    const res = await importKeywords(text, format);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setSummary(res);
    if (res.inserted > 0) router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload size={14} /> Import
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Import keywords</DialogTitle></DialogHeader>

        <div className="flex gap-1 p-1 rounded-[var(--r-md)] w-fit" style={{ background: "var(--fill-100)" }} role="tablist">
          {(["lines", "csv"] as const).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={format === f} onClick={() => setFormat(f)}
              className="px-3 py-1 rounded-[var(--r-sm)] text-[13px] font-semibold"
              style={format === f ? { background: "var(--surface)", color: "var(--ink-900)" } : { color: "var(--ink-500)" }}>
              {f === "lines" ? "One per line" : "CSV"}
            </button>
          ))}
        </div>

        {format === "csv" && (
          <div className="flex flex-col gap-1.5 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            <span>Header row with a <code>keyword</code> column. Optional: target_class, subject, priority, status, search_intent, notes.</span>
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-[13px]" aria-label="Upload CSV file" />
          </div>
        )}

        <textarea className={`${inputCls} font-mono text-[12.5px]`} style={inputStyle} rows={9} value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={format === "lines" ? "maths olympiad class 5\nimo preparation tips\nnso class 6 sample paper" : CSV_EXAMPLE}
          aria-label="Keywords to import" />

        <FormError message={error} />
        {summary && (
          <div role="status" className="text-[13px] p-3 rounded-[var(--r-md)] flex flex-col gap-1" style={{ background: "var(--paper-2)", color: "var(--ink-700)" }}>
            <span><strong>{summary.inserted}</strong> added · {summary.alreadyExisted} already existed · {summary.duplicatesInFile} duplicate(s) in the import</span>
            {summary.errors.length > 0 && (
              <ul className="list-disc pl-5" style={{ color: "var(--danger-tx)" }}>
                {summary.errors.slice(0, 10).map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}
                {summary.errors.length > 10 && <li>…and {summary.errors.length - 10} more</li>}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button type="button" onClick={submit} disabled={pending || !text.trim()}>{pending ? "Importing…" : "Import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
