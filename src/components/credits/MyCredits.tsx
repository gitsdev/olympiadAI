"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight,
  Coins, Gift, Info, Loader2, ShieldCheck, ShoppingCart, Sparkles,
} from "lucide-react";
import { OAButton } from "@/components/ui/oa-button";
import { cn } from "@/lib/utils";
import {
  MIN_PURCHASE_CREDITS, PURCHASE_STATUS_LABELS, SUGGESTED_PURCHASES, TRANSACTION_TYPE_LABELS,
  creditsToPaise, formatCredits, formatInr, validatePurchaseCredits,
  type CreditPurchaseStatus, type CreditTransactionType,
} from "@/lib/credits/constants";
import { openCheckout } from "./razorpay-checkout";

interface Summary { balance: number; purchased: number; welcome: number; consumed: number; refunded: number; adjusted: number }
interface Tx {
  id: string; transaction_type: CreditTransactionType; amount: number; balance_after: number;
  feature_key: string | null; description: string | null; created_at: string;
}
interface Purchase {
  id: string; credits: number; amount_paise: number; status: CreditPurchaseStatus;
  razorpay_payment_id: string | null; refunded_credits: number; created_at: string; paid_at: string | null;
}
interface PricedFeature { featureKey: string; featureName: string; creditCost: number }
interface Page<T> { rows: T[]; page: number; pageSize: number; totalCount: number }

type Notice = { tone: "success" | "error" | "info"; text: string } | null;

const PAGE_SIZE = 10;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong. Please try again.");
  return data as T;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

export function MyCredits() {
  const router = useRouter();
  const buyRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [features, setFeatures] = useState<PricedFeature[]>([]);
  const [tab, setTab] = useState<"activity" | "purchases">("activity");
  const [txPage, setTxPage] = useState(1);
  const [txs, setTxs] = useState<Page<Tx> | null>(null);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchases, setPurchases] = useState<Page<Purchase> | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api<{ summary: Summary }>("/api/credits/balance?summary=1");
      setSummary(data.summary);
      setLoadError(null);
      return data.summary;
    } catch (e) {
      setLoadError((e as Error).message);
      return null;
    }
  }, []);

  const loadTxs = useCallback(async (page: number) => {
    try {
      setTxs(await api<Page<Tx>>(`/api/credits/history?kind=transactions&page=${page}&pageSize=${PAGE_SIZE}`));
    } catch { /* table shows its own empty state */ }
  }, []);

  const loadPurchases = useCallback(async (page: number) => {
    try {
      setPurchases(await api<Page<Purchase>>(`/api/credits/history?kind=purchases&page=${page}&pageSize=${PAGE_SIZE}`));
    } catch { /* ignore */ }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSummary(), loadTxs(1), loadPurchases(1)]);
    setTxPage(1);
    setPurchasePage(1);
    router.refresh(); // updates the balance chip in the top bar
  }, [loadSummary, loadTxs, loadPurchases, router]);

  // First load: settle any payment whose confirmation we missed (closed tab,
  // delayed webhook), then show the up-to-date wallet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = await api<{ fulfilled: number }>("/api/credits/purchase/reconcile", { method: "POST" }).catch(() => null);
      if (cancelled) return;
      if (rec?.fulfilled) setNotice({ tone: "success", text: "We found a completed payment and added the credits to your wallet." });
      await Promise.all([loadSummary(), loadTxs(1), loadPurchases(1)]);
      if (rec?.fulfilled) router.refresh();
      api<{ features: PricedFeature[] }>("/api/credits/pricing").then((d) => !cancelled && setFeatures(d.features)).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [loadSummary, loadTxs, loadPurchases, router]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-7 py-6 pb-12 flex flex-col gap-5">
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}
      {loadError && !summary && <NoticeBar notice={{ tone: "error", text: loadError }} onClose={() => setLoadError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <BalanceCard summary={summary} onBuy={() => buyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          <StatsRow summary={summary} />

          <section className="rounded-[var(--r-lg)] border bg-[var(--surface)] shadow-[var(--shadow-sm)] min-w-0"
            style={{ borderColor: "var(--line-200)" }}>
            <div className="flex items-center gap-1 px-4 pt-4" role="tablist" aria-label="Credit history">
              <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>Credit history</TabButton>
              <TabButton active={tab === "purchases"} onClick={() => setTab("purchases")}>Purchases</TabButton>
            </div>
            <div className="p-4 pt-3">
              {tab === "activity" ? (
                <TransactionList
                  data={txs}
                  onPage={(p) => { setTxPage(p); loadTxs(p); }}
                  page={txPage}
                />
              ) : (
                <PurchaseList
                  data={purchases}
                  onPage={(p) => { setPurchasePage(p); loadPurchases(p); }}
                  page={purchasePage}
                />
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-4" ref={buyRef}>
          <BuyCredits onNotice={setNotice} onPurchased={refreshAll} />
          <FeatureCosts features={features} />
        </div>
      </div>
    </div>
  );
}

// ── Balance + stats ───────────────────────────────────────────────────────

function BalanceCard({ summary, onBuy }: { summary: Summary | null; onBuy: () => void }) {
  return (
    <section
      className="rounded-[var(--r-xl)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between text-white shadow-[var(--shadow-md)]"
      style={{ background: "linear-gradient(135deg, var(--cobalt-600), var(--cobalt-900))" }}
      aria-label="Credit balance"
    >
      <div className="flex items-center gap-4 min-w-0">
        <span className="w-12 h-12 rounded-[var(--r-lg)] flex items-center justify-center shrink-0"
          style={{ background: "oklch(1 0 0 / 0.14)" }}>
          <Coins size={24} style={{ color: "var(--gold-300)" }} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium" style={{ color: "oklch(1 0 0 / 0.75)" }}>Available credits</p>
          <p className="font-black leading-none tracking-tight mt-1 tabular-nums"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 6vw, 44px)" }}>
            {summary ? formatCredits(summary.balance) : <span className="inline-block w-24 h-9 rounded bg-white/15 animate-pulse align-middle" />}
          </p>
          <p className="text-[12.5px] mt-1.5" style={{ color: "oklch(1 0 0 / 0.7)" }}>1 credit = ₹1 · Credits never expire</p>
        </div>
      </div>
      <OAButton variant="gold" onClick={onBuy} className="self-start sm:self-auto">
        <ShoppingCart size={16} /> Buy credits
      </OAButton>
    </section>
  );
}

function StatsRow({ summary }: { summary: Summary | null }) {
  const items = [
    { label: "Purchased", value: summary?.purchased, Icon: ArrowDownLeft, color: "var(--cobalt-500)" },
    { label: "Welcome credits", value: summary?.welcome, Icon: Gift, color: "var(--gold-700)" },
    { label: "Used", value: summary?.consumed, Icon: ArrowUpRight, color: "var(--subj-english)" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, value, Icon, color }) => (
        <div key={label} className="rounded-[var(--r-lg)] border bg-[var(--surface)] p-3 sm:p-4 min-w-0"
          style={{ borderColor: "var(--line-200)" }}>
          <div className="flex items-center gap-1.5 text-[12px] font-medium truncate" style={{ color: "var(--fg-muted)" }}>
            <Icon size={14} style={{ color, flexShrink: 0 }} /> <span className="truncate">{label}</span>
          </div>
          <p className="mt-1.5 font-bold text-[20px] sm:text-[22px] tabular-nums" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
            {value === undefined ? "–" : formatCredits(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Buy ───────────────────────────────────────────────────────────────────

function BuyCredits({ onNotice, onPurchased }: { onNotice: (n: Notice) => void; onPurchased: () => Promise<void> }) {
  const [credits, setCredits] = useState<number>(500);
  const [raw, setRaw] = useState("500");
  const [busy, setBusy] = useState<null | "order" | "checkout" | "verify">(null);
  const invalid = validatePurchaseCredits(credits);

  function pick(n: number) {
    setCredits(n);
    setRaw(String(n));
  }

  async function waitForCredits(): Promise<boolean> {
    // The webhook usually lands within seconds; reconcile asks Razorpay directly.
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const rec = await api<{ fulfilled: number }>("/api/credits/purchase/reconcile", { method: "POST" }).catch(() => null);
      if (rec?.fulfilled) return true;
    }
    return false;
  }

  async function buy() {
    if (invalid || busy) return;
    onNotice(null);
    try {
      setBusy("order");
      const order = await api<{
        orderId: string; keyId: string; amountPaise: number; credits: number; prefill: { name: string; email: string };
      }>("/api/credits/purchase/create-order", { method: "POST", body: JSON.stringify({ credits }) });

      setBusy("checkout");
      const result = await openCheckout(order);
      if (!result) {
        onNotice({ tone: "info", text: "Payment cancelled. No money was taken." });
        return;
      }

      setBusy("verify");
      const verified = await api<{ status: "paid" | "processing" | "failed"; credits?: number }>(
        "/api/credits/purchase/verify", { method: "POST", body: JSON.stringify(result) },
      ).catch(() => ({ status: "processing" as const }));

      if (verified.status === "paid") {
        onNotice({ tone: "success", text: `Payment successful — ${formatCredits(verified.credits ?? order.credits)} credits added to your wallet.` });
      } else if (verified.status === "failed") {
        onNotice({ tone: "error", text: "The payment didn't go through. No credits were added." });
      } else {
        onNotice({ tone: "info", text: "Payment received — confirming with the bank. Your credits will appear in a moment." });
        const ok = await waitForCredits();
        onNotice(ok
          ? { tone: "success", text: `Payment confirmed — ${formatCredits(order.credits)} credits added to your wallet.` }
          : { tone: "info", text: "Your payment is still being confirmed. Credits are added automatically once it completes — you can safely leave this page." });
      }
      await onPurchased();
    } catch (e) {
      onNotice({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const label = busy === "order" ? "Preparing…" : busy === "checkout" ? "Complete payment in the window…" : busy === "verify" ? "Confirming payment…" : `Pay ${invalid ? "" : formatInr(creditsToPaise(credits))}`;

  return (
    <section className="rounded-[var(--r-lg)] border bg-[var(--surface)] shadow-[var(--shadow-sm)] p-5"
      style={{ borderColor: "var(--line-200)" }} aria-labelledby="buy-credits-title">
      <h2 id="buy-credits-title" className="font-bold text-[18px] tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
        Buy credits
      </h2>
      <p className="text-[13px] mt-1" style={{ color: "var(--fg-muted)" }}>Minimum {MIN_PURCHASE_CREDITS} credits. 1 credit = ₹1.</p>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {SUGGESTED_PURCHASES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pick(n)}
            aria-pressed={credits === n}
            className={cn(
              "rounded-[var(--r-md)] border px-3 py-2.5 text-left transition-colors duration-[120ms]",
              credits === n ? "border-[var(--cobalt-500)] bg-[var(--cobalt-50)]" : "border-[var(--line-300)] hover:bg-[var(--fill-100)]",
            )}
          >
            <span className="block font-bold text-[15px] tabular-nums" style={{ color: "var(--ink-900)" }}>{formatCredits(n)} credits</span>
            <span className="block text-[12px] tabular-nums" style={{ color: "var(--fg-muted)" }}>{formatInr(creditsToPaise(n))}</span>
          </button>
        ))}
      </div>

      <label htmlFor="credit-qty" className="block text-[13px] font-semibold mt-4" style={{ color: "var(--ink-700)" }}>
        Or enter an amount
      </label>
      <div className="mt-1.5 flex items-center gap-2 rounded-[var(--r-md)] border px-3 py-2 focus-within:border-[var(--cobalt-400)]"
        style={{ borderColor: invalid && raw !== "" ? "var(--danger)" : "var(--line-300)" }}>
        <Coins size={16} style={{ color: "var(--gold-700)", flexShrink: 0 }} />
        <input
          id="credit-qty"
          inputMode="numeric"
          value={raw}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, "").slice(0, 7);
            setRaw(v);
            setCredits(v === "" ? 0 : Number(v));
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-semibold tabular-nums"
          style={{ color: "var(--ink-900)" }}
          aria-describedby="credit-qty-help"
          aria-invalid={!!invalid}
        />
        <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>credits</span>
      </div>
      <p id="credit-qty-help" className="text-[12.5px] mt-1.5 min-h-[18px]" style={{ color: invalid && raw !== "" ? "var(--danger-tx)" : "var(--fg-muted)" }}>
        {invalid ? (raw === "" ? "Enter how many credits you want." : invalid) : `${formatCredits(credits)} credits = ${formatInr(creditsToPaise(credits))}`}
      </p>

      <OAButton variant="primary" className="w-full mt-3" onClick={buy} disabled={!!invalid || busy !== null}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        {label}
      </OAButton>
      <p className="text-[11.5px] mt-2.5 text-center" style={{ color: "var(--fg-subtle)" }}>
        Secure payment by Razorpay · UPI, cards, netbanking & wallets
      </p>
    </section>
  );
}

function FeatureCosts({ features }: { features: PricedFeature[] }) {
  return (
    <section className="rounded-[var(--r-lg)] border p-4" style={{ borderColor: "var(--line-200)", background: "var(--paper-2)" }}>
      <h3 className="flex items-center gap-1.5 text-[13.5px] font-bold" style={{ color: "var(--ink-900)" }}>
        <Sparkles size={15} style={{ color: "var(--brand)" }} /> What credits are used for
      </h3>
      {features.length === 0 ? (
        <p className="text-[12.5px] mt-1.5" style={{ color: "var(--fg-muted)" }}>
          No features use credits yet. We&apos;ll show prices here before anything starts using them.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {features.map((f) => (
            <li key={f.featureKey} className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--ink-700)" }}>{f.featureName}</span>
              <span className="font-semibold tabular-nums" style={{ color: "var(--ink-900)" }}>{f.creditCost} credits</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── History ───────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-[var(--r-md)] text-[13.5px] font-semibold transition-colors",
        active ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)]" : "text-[var(--ink-500)] hover:bg-[var(--fill-100)]",
      )}
    >
      {children}
    </button>
  );
}

function TransactionList({ data, page, onPage }: { data: Page<Tx> | null; page: number; onPage: (p: number) => void }) {
  if (!data) return <ListSkeleton />;
  if (data.rows.length === 0) return <Empty text="No credit activity yet." />;
  return (
    <>
      <ul className="divide-y" style={{ borderColor: "var(--line-200)" }}>
        {data.rows.map((t) => {
          const positive = t.amount > 0;
          return (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: positive ? "var(--success-bg)" : "var(--fill-100)" }}>
                {positive ? <ArrowDownLeft size={15} style={{ color: "var(--success-tx)" }} /> : <ArrowUpRight size={15} style={{ color: "var(--ink-500)" }} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>
                  {t.description || TRANSACTION_TYPE_LABELS[t.transaction_type]}
                </p>
                <p className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
                  {TRANSACTION_TYPE_LABELS[t.transaction_type]} · {fmtDate(t.created_at)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-bold tabular-nums" style={{ color: positive ? "var(--success-tx)" : "var(--ink-900)" }}>
                  {positive ? "+" : "−"}{formatCredits(Math.abs(t.amount))}
                </p>
                <p className="text-[11.5px] tabular-nums" style={{ color: "var(--fg-subtle)" }}>Bal {formatCredits(t.balance_after)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <Pager page={page} total={data.totalCount} onPage={onPage} />
    </>
  );
}

const STATUS_TONE: Record<CreditPurchaseStatus, { bg: string; fg: string }> = {
  paid: { bg: "var(--success-bg)", fg: "var(--success-tx)" },
  pending: { bg: "var(--warning-bg)", fg: "var(--warning-tx)" },
  failed: { bg: "var(--danger-bg)", fg: "var(--danger-tx)" },
  refunded: { bg: "var(--fill-100)", fg: "var(--ink-700)" },
  partially_refunded: { bg: "var(--fill-100)", fg: "var(--ink-700)" },
};

function PurchaseList({ data, page, onPage }: { data: Page<Purchase> | null; page: number; onPage: (p: number) => void }) {
  if (!data) return <ListSkeleton />;
  if (data.rows.length === 0) return <Empty text="You haven't bought any credits yet." />;
  return (
    <>
      <ul className="divide-y" style={{ borderColor: "var(--line-200)" }}>
        {data.rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>
                {formatCredits(p.credits)} credits · {formatInr(p.amount_paise)}
              </p>
              <p className="text-[12px] truncate" style={{ color: "var(--fg-muted)" }}>
                {fmtDate(p.paid_at ?? p.created_at)}{p.razorpay_payment_id ? ` · ${p.razorpay_payment_id}` : ""}
              </p>
            </div>
            <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-[var(--r-pill)] shrink-0"
              style={{ background: STATUS_TONE[p.status].bg, color: STATUS_TONE[p.status].fg }}>
              {PURCHASE_STATUS_LABELS[p.status]}
            </span>
          </li>
        ))}
      </ul>
      <Pager page={page} total={data.totalCount} onPage={onPage} />
    </>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"
        className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] border disabled:opacity-40"
        style={{ borderColor: "var(--line-200)" }}>
        <ChevronLeft size={15} />
      </button>
      <span className="text-[12.5px] tabular-nums" style={{ color: "var(--ink-700)" }}>{page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"
        className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] border disabled:opacity-40"
        style={{ borderColor: "var(--line-200)" }}>
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2" aria-busy>
      {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-[var(--r-md)] animate-pulse" style={{ background: "var(--fill-100)" }} />)}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-muted)" }}>{text}</p>;
}

function NoticeBar({ notice, onClose }: { notice: NonNullable<Notice>; onClose: () => void }) {
  const tone = {
    success: { bg: "var(--success-bg)", fg: "var(--success-tx)", Icon: CheckCircle2 },
    error: { bg: "var(--danger-bg)", fg: "var(--danger-tx)", Icon: AlertCircle },
    info: { bg: "var(--info-bg)", fg: "var(--cobalt-700)", Icon: Info },
  }[notice.tone];
  return (
    <div role={notice.tone === "error" ? "alert" : "status"} className="flex items-start gap-2.5 rounded-[var(--r-md)] px-4 py-3 text-[13.5px]"
      style={{ background: tone.bg, color: tone.fg }}>
      <tone.Icon size={17} className="shrink-0 mt-px" />
      <span className="flex-1">{notice.text}</span>
      <button type="button" onClick={onClose} className="text-[12px] font-semibold underline underline-offset-2 shrink-0">Dismiss</button>
    </div>
  );
}
