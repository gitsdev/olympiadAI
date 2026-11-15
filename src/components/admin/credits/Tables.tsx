import Link from "next/link";
import { PURCHASE_STATUS_LABELS, TRANSACTION_TYPE_LABELS, formatCredits, formatInr } from "@/lib/credits/constants";
import type { WithProfile } from "@/lib/credits/admin";
import type { CreditPurchase, CreditTransaction } from "@/lib/credits/types";
import { FEATURE_LABELS, fmtDateTime } from "./format";
import { RefundPurchaseDialog, RefundUsageDialog } from "./RefundDialogs";

const th = "px-4 py-2.5 font-semibold whitespace-nowrap";
const td = "px-4 py-2.5 align-top";

function Shell({ children, minWidth }: { children: React.ReactNode; minWidth: number }) {
  return (
    <div className="rounded-[var(--r-lg)] border overflow-x-auto" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
      <table className="w-full text-[13px]" style={{ minWidth }}>{children}</table>
    </div>
  );
}

function StudentCell({ student, userId }: { student: { full_name: string; email: string } | null; userId: string | null }) {
  if (!userId) return <span style={{ color: "var(--fg-subtle)" }}>Deleted account</span>;
  return (
    <Link href={`/admin/credits/students/${userId}`} className="hover:underline">
      <span className="block font-semibold" style={{ color: "var(--ink-900)" }}>{student?.full_name || "—"}</span>
      <span className="block text-[12px]" style={{ color: "var(--fg-muted)" }}>{student?.email}</span>
    </Link>
  );
}

export function TransactionsTable({
  rows, showStudent = true, canRefundUsage = false, reversedIds = new Set<string>(),
}: {
  rows: WithProfile<CreditTransaction>[] | CreditTransaction[];
  showStudent?: boolean;
  canRefundUsage?: boolean;
  /** Usage transaction ids that already have a reversal. */
  reversedIds?: Set<string>;
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] py-10 text-center rounded-[var(--r-lg)] border" style={{ color: "var(--fg-muted)", borderColor: "var(--line-200)" }}>No transactions match these filters.</p>;
  }
  return (
    <Shell minWidth={showStudent ? 900 : 700}>
      <thead>
        <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)", background: "var(--paper-2)" }}>
          <th className={th}>Date</th>
          {showStudent && <th className={th}>Student</th>}
          <th className={th}>Type</th>
          <th className={th}>Details</th>
          <th className={`${th} text-right`}>Amount</th>
          <th className={`${th} text-right`}>Balance after</th>
          {canRefundUsage && <th className={th} />}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const student = "student" in r ? r.student : null;
          const reason = typeof r.metadata?.reason === "string" ? r.metadata.reason : null;
          return (
            <tr key={r.id} className="border-t" style={{ borderColor: "var(--line-200)" }}>
              <td className={`${td} whitespace-nowrap`} style={{ color: "var(--ink-700)" }}>{fmtDateTime(r.created_at)}</td>
              {showStudent && <td className={td}><StudentCell student={student} userId={r.user_id} /></td>}
              <td className={`${td} whitespace-nowrap`}>{TRANSACTION_TYPE_LABELS[r.transaction_type]}</td>
              <td className={td} style={{ color: "var(--ink-700)" }}>
                {r.feature_key ? <span className="font-medium">{FEATURE_LABELS[r.feature_key] ?? r.feature_key} · </span> : null}
                {r.description}
                {reason && reason !== r.description && <span className="block text-[12px]" style={{ color: "var(--fg-muted)" }}>Reason: {reason}</span>}
              </td>
              <td className={`${td} text-right font-bold tabular-nums`} style={{ color: r.amount > 0 ? "var(--success-tx)" : "var(--ink-900)" }}>
                {r.amount > 0 ? "+" : "−"}{formatCredits(Math.abs(r.amount))}
              </td>
              <td className={`${td} text-right tabular-nums`}>{formatCredits(r.balance_after)}</td>
              {canRefundUsage && (
                <td className={`${td} text-right`}>
                  {r.transaction_type === "usage" && !reversedIds.has(r.id) && r.user_id && (
                    <RefundUsageDialog transactionId={r.id} credits={Math.abs(r.amount)} />
                  )}
                  {r.transaction_type === "usage" && reversedIds.has(r.id) && (
                    <span className="text-[12px]" style={{ color: "var(--fg-subtle)" }}>Refunded</span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Shell>
  );
}

const STATUS_STYLE: Record<CreditPurchase["status"], { bg: string; fg: string }> = {
  paid: { bg: "var(--success-bg)", fg: "var(--success-tx)" },
  pending: { bg: "var(--warning-bg)", fg: "var(--warning-tx)" },
  failed: { bg: "var(--danger-bg)", fg: "var(--danger-tx)" },
  refunded: { bg: "var(--fill-100)", fg: "var(--ink-700)" },
  partially_refunded: { bg: "var(--fill-100)", fg: "var(--ink-700)" },
};

export function PurchasesTable({ rows, canRefund = false }: { rows: WithProfile<CreditPurchase>[]; canRefund?: boolean }) {
  if (rows.length === 0) {
    return <p className="text-[13px] py-10 text-center rounded-[var(--r-lg)] border" style={{ color: "var(--fg-muted)", borderColor: "var(--line-200)" }}>No purchases match these filters.</p>;
  }
  return (
    <Shell minWidth={1000}>
      <thead>
        <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)", background: "var(--paper-2)" }}>
          <th className={th}>Date</th>
          <th className={th}>Student</th>
          <th className={`${th} text-right`}>Credits</th>
          <th className={`${th} text-right`}>Amount</th>
          <th className={th}>Status</th>
          <th className={th}>Razorpay order / payment</th>
          {canRefund && <th className={th} />}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const refundable = p.credits - p.refunded_credits;
          return (
            <tr key={p.id} className="border-t" style={{ borderColor: "var(--line-200)" }}>
              <td className={`${td} whitespace-nowrap`} style={{ color: "var(--ink-700)" }}>
                {fmtDateTime(p.created_at)}
                {p.paid_at && <span className="block text-[12px]" style={{ color: "var(--fg-muted)" }}>Paid {fmtDateTime(p.paid_at)}</span>}
              </td>
              <td className={td}><StudentCell student={p.student} userId={p.user_id} /></td>
              <td className={`${td} text-right tabular-nums font-semibold`}>{formatCredits(p.credits)}</td>
              <td className={`${td} text-right tabular-nums`}>
                {formatInr(p.amount_paise)}
                {p.refunded_paise > 0 && <span className="block text-[12px]" style={{ color: "var(--danger-tx)" }}>−{formatInr(p.refunded_paise)} refunded</span>}
              </td>
              <td className={td}>
                <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-[var(--r-pill)] whitespace-nowrap"
                  style={{ background: STATUS_STYLE[p.status].bg, color: STATUS_STYLE[p.status].fg }}>
                  {PURCHASE_STATUS_LABELS[p.status]}
                </span>
              </td>
              <td className={td} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-700)" }}>
                {p.razorpay_order_id}<br />{p.razorpay_payment_id ?? "—"}
              </td>
              {canRefund && (
                <td className={`${td} text-right`}>
                  {(p.status === "paid" || p.status === "partially_refunded") && refundable > 0 && (
                    <RefundPurchaseDialog purchaseId={p.id} refundableCredits={refundable} studentName={p.student?.full_name || "the student"} />
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Shell>
  );
}
