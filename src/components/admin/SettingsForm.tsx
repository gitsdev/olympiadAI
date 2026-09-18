"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateAdminSettings } from "@/actions/admin/settings";
import type { AdminSettingsRow } from "@/types/database";

export function SettingsForm({ settings }: { settings: AdminSettingsRow }) {
  const router = useRouter();
  const [values, setValues] = useState({
    inactiveDaysWarning: settings.inactive_days_warning,
    inactiveDaysCritical: settings.inactive_days_critical,
    lowScoreThreshold: settings.low_score_threshold,
    lowAiEngagementSessions: settings.low_ai_engagement_sessions,
  });
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setPending(true);
    setSaved(false);
    await updateAdminSettings(values);
    setPending(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <Field
        label="Inactivity warning threshold (days)"
        hint="Students inactive this many days appear under 'Students Needing Attention'."
        value={values.inactiveDaysWarning}
        onChange={(v) => setValues((s) => ({ ...s, inactiveDaysWarning: v }))}
      />
      <Field
        label="Inactivity critical threshold (days)"
        hint="Used for stricter inactivity views."
        value={values.inactiveDaysCritical}
        onChange={(v) => setValues((s) => ({ ...s, inactiveDaysCritical: v }))}
      />
      <Field
        label="Low mock-test score threshold (%)"
        hint="Average scores below this flag a student for attention."
        value={values.lowScoreThreshold}
        onChange={(v) => setValues((s) => ({ ...s, lowScoreThreshold: v }))}
      />
      <Field
        label="Low AI Tutor engagement threshold (sessions)"
        hint="Students at or below this session count flag as low engagement."
        value={values.lowAiEngagementSessions}
        onChange={(v) => setValues((s) => ({ ...s, lowAiEngagementSessions: v }))}
      />

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
        {saved && <span className="text-[12.5px]" style={{ color: "var(--success-tx)" }}>Saved</span>}
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange }: {
  label: string; hint: string; value: number; onChange: (v: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="max-w-[160px]"
      />
      <p className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>{hint}</p>
    </div>
  );
}
