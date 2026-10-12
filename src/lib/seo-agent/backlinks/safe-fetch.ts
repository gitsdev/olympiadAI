import "server-only";

// Fetches an external web page for backlink evaluation and link checks.
// Admin-entered URLs are fetched from our server, so this guards against
// SSRF: only http(s) on default ports, no credentials in the URL, every
// hop's host must resolve to public IP addresses, at most 3 redirects
// (each re-checked), 10 s timeout, HTML only, body capped at 1.5 MB.
// (DNS can change between the check and the fetch; acceptable for an
// admin-only tool, and the checks still stop accidental internal fetches.)

import { lookup } from "node:dns/promises";
import { isPublicIp, validateFetchUrl } from "./url-safety";

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "OlympiadIQ-SEO-Agent/1.0 (+https://www.olympiadiq.in)";

export type FetchPageResult =
  | { ok: true; url: string; status: number; html: string }
  | { ok: false; url: string; status: number | null; error: string };

async function assertPublicHost(hostname: string): Promise<void> {
  const addrs = await lookup(hostname, { all: true, verbatim: true });
  if (addrs.length === 0) throw new Error("Host has no addresses.");
  const bad = addrs.find((a) => !isPublicIp(a.address));
  if (bad) throw new Error("Refusing to fetch a private or internal network address.");
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

export async function fetchPage(rawUrl: string): Promise<FetchPageResult> {
  let url = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = validateFetchUrl(url);
    if (!check.ok) return { ok: false, url, status: null, error: check.error };
    try {
      await assertPublicHost(check.url.hostname);
      const res = await fetch(check.url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, url, status: res.status, error: "Redirect without a location." };
        url = new URL(loc, check.url).href;
        continue;
      }
      if (!res.ok) return { ok: false, url, status: res.status, error: `The page returned HTTP ${res.status}.` };
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml/i.test(type)) return { ok: false, url, status: res.status, error: `Not an HTML page (${type || "unknown type"}).` };
      return { ok: true, url, status: res.status, html: await readCapped(res) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, url, status: null, error: /aborted|timeout/i.test(msg) ? "The page took too long to respond." : msg };
    }
  }
  return { ok: false, url, status: null, error: "Too many redirects." };
}
