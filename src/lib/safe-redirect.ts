// Validates a "return to this page after login" value (?next=…), so it can
// only ever point at a page on this site. Anything else — another domain,
// protocol-relative "//evil.com", backslash tricks, javascript: URLs — is
// rejected, preventing open redirects. Client-safe.

const BASE = "http://olympiadiq.local";

/** Pages it never makes sense to "return" to after signing in. */
const NO_RETURN = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/auth/"];

/** A same-site path (with query/hash) to redirect to, or null if unsafe or unusable. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  // Must be a plain absolute path. Rejects "//host", "/\host", "http:…", "javascript:…".
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 2000) return null;
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;

  let url: URL;
  try {
    url = new URL(v, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  if (url.pathname.startsWith("/api/")) return null;
  if (NO_RETURN.some((p) => url.pathname === p || (p.endsWith("/") && url.pathname.startsWith(p)))) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
