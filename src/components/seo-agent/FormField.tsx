// Shared form styling for SEO Agent forms (matches the blog editor's inputs).

export const inputCls = "w-full px-3 py-2 rounded-[var(--r-md)] border text-[14px] outline-none focus:border-[var(--cobalt-400)]";
export const inputStyle = { borderColor: "var(--line-300)", background: "var(--surface)", color: "var(--ink-900)" } as const;

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{label}</span>
      {children}
      {error ? (
        <span className="text-[12px]" style={{ color: "var(--danger-tx)" }}>{error}</span>
      ) : hint ? (
        <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>{hint}</span>
      ) : null}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[12.5px] p-2.5 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
      {message}
    </p>
  );
}
