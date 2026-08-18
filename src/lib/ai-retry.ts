// Free-tier model APIs (Gemini in particular) return 503 "high demand" /
// 429 rate-limit errors far more often than a paid Anthropic key did.
// Retry those transient failures with a short backoff before giving up.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 600): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      // 503/429 are the documented transient free-tier errors; other 5xx and
      // network-level failures (no status — timeout, ECONNRESET, etc.) are
      // also worth a retry rather than failing the whole batch outright.
      const retryable = status === undefined || status === 429 || (status >= 500 && status < 600);
      if (!retryable || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}
