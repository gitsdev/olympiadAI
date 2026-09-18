"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportCsvButtonProps {
  label?: string;
  filename: string;
  onExport: () => Promise<{ csv: string; truncated: boolean }>;
}

export function ExportCsvButton({ label = "Export CSV", filename, onExport }: ExportCsvButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const { csv, truncated } = await onExport();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      if (truncated) {
        window.alert(`Export capped at the first 5,000 matching rows. Narrow your filters to export the rest.`);
      }
    } catch {
      window.alert("Export failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending} aria-label={label}>
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {label}
    </Button>
  );
}
