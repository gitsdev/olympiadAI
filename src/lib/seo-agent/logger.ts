// Structured logging for SEO Agent workflows. Emits one JSON line per event so
// Vercel's log search can filter on `scope`/`event`. Values under keys that
// look like credentials are redacted before they're written.

type Level = "info" | "warn" | "error";

const SECRET_KEY = /(secret|token|password|api[_-]?key|authorization|private[_-]?key|service[_-]?role)/i;

/** Deep-copies `value`, replacing anything under a secret-looking key. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SECRET_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  }
  return out;
}

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ scope: "seo-agent", level, event, time: new Date().toISOString(), ...(redact(data ?? {}) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const seoLog = {
  info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),
};

/** Best-effort readable message from anything thrown. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}
