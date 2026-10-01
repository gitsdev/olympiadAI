"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { buildCampaignEmail, unsubscribePageUrl, type CampaignId, type CampaignRecipient } from "@/lib/email/campaign-templates";

interface EmailPreviewProps {
  campaignId: CampaignId;
  samples: { label: string; recipient: CampaignRecipient }[];
  height?: number;
}

/** Renders a campaign email exactly as it will be sent, in a sandboxed iframe. */
export function EmailPreview({ campaignId, samples, height = 720 }: EmailPreviewProps) {
  const [index, setIndex] = useState(0);
  const sample = samples[Math.min(index, samples.length - 1)];
  const email = buildCampaignEmail(campaignId, sample.recipient, unsubscribePageUrl("preview"));

  return (
    <div className="flex flex-col gap-2">
      {samples.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {samples.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "text-[12.5px] font-medium px-3 py-1.5 rounded-[var(--r-md)] border transition-colors",
                i === index ? "bg-[var(--cobalt-50)] border-[var(--cobalt-200)] text-[var(--cobalt-700)]" : "border-[var(--line-200)] hover:bg-[var(--fill-100)]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <p className="text-[13px]" style={{ color: "var(--ink-900)" }}>
        <span style={{ color: "var(--fg-muted)" }}>Subject:</span> <strong>{email.subject}</strong>
      </p>
      <iframe
        title="Email preview"
        srcDoc={email.html}
        sandbox=""
        className="w-full rounded-[var(--r-lg)] border"
        style={{ height, borderColor: "var(--line-200)", background: "#F3F4F8" }}
      />
    </div>
  );
}
