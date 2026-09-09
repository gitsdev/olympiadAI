import Link from "next/link";
import { Info } from "lucide-react";
import { AFFILIATE_DISCLOSURE_SHORT, AFFILIATE_PRICE_DISCLAIMER } from "@/lib/blog";

/**
 * Amazon Associates Operating Agreement requires a clear and conspicuous
 * disclosure on every page that contains affiliate links. This renders it
 * near the top of the content, above the fold.
 */
export function AffiliateDisclosure({ withPriceNote = false }: { withPriceNote?: boolean }) {
  return (
    <aside
      className="my-6 p-4 rounded-[var(--r-md)] border text-[12.5px] leading-[1.65]"
      style={{ background: "var(--fill-100)", borderColor: "var(--line-200)", color: "var(--ink-500)" }}
      aria-label="Affiliate disclosure"
    >
      <div className="flex gap-2.5">
        <Info size={15} className="mt-0.5 shrink-0" style={{ color: "var(--ink-400)" }} />
        <div>
          <p>
            <strong style={{ color: "var(--ink-700)" }}>Disclosure:</strong> {AFFILIATE_DISCLOSURE_SHORT}{" "}
            <Link href="/blog/affiliate-disclosure" className="underline" style={{ color: "var(--brand)" }}>
              Learn more
            </Link>
            .
          </p>
          {withPriceNote && <p className="mt-1.5">{AFFILIATE_PRICE_DISCLAIMER}</p>}
        </div>
      </div>
    </aside>
  );
}
