// URL and IP checks for server-side fetching of admin-entered URLs. Pure, unit-tested.

import { isIP } from "node:net";

export function validateFetchUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: "Only http and https URLs can be checked." };
  if (url.username || url.password) return { ok: false, error: "URLs with credentials aren't allowed." };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, error: "Only standard web ports are allowed." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicIp(host)) return { ok: false, error: "Refusing to fetch a private or internal network address." };
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) {
    return { ok: false, error: "Refusing to fetch a private or internal network address." };
  }
  return { ok: true, url };
}

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

/** False for loopback, private, link-local, CGNAT, multicast, documentation and reserved ranges. */
export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const n = v4ToInt(ip);
    return !V4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (v4ToInt(base) & mask);
    });
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPublicIp(mapped[1]);
    if (v === "::" || v === "::1") return false;
    if (/^f[cd]/.test(v)) return false; // unique local fc00::/7
    if (/^fe[89ab]/.test(v)) return false; // link-local fe80::/10
    if (/^ff/.test(v)) return false; // multicast
    if (v.startsWith("2001:db8")) return false; // documentation
    return true;
  }
  return false;
}
