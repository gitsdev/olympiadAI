/** POST JSON to an admin credit endpoint; throws with the server's user-safe message. */
export async function postAdmin<T = Record<string, unknown>>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed. Please try again.");
  return data as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
