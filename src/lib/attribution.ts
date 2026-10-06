export const ATTRIBUTION_COOKIE = "oiq_attr";
export const ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface SignupAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: boolean;
  fbclid?: boolean;
  referrer_host?: string;
  landing_path?: string;
  captured_at?: string;
}

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsocial", "paid_social", "paidsearch", "paid_search", "ad", "ads"]);
const FACEBOOK_SOURCES = new Set(["facebook", "fb", "instagram", "ig", "meta"]);

export function parseAttribution(raw: string | undefined): SignupAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return parsed && typeof parsed === "object" ? (parsed as SignupAttribution) : null;
  } catch {
    return null;
  }
}

export function classifySource(a: SignupAttribution | null): string {
  if (!a) return "Unknown";

  const src = (a.utm_source ?? "").toLowerCase();
  const medium = (a.utm_medium ?? "").toLowerCase();
  const paid = PAID_MEDIUMS.has(medium);

  if (src) {
    if (src === "google") return paid || a.gclid ? "Google Ads" : "Google Search";
    if (FACEBOOK_SOURCES.has(src)) return paid ? "Facebook / Instagram Ads" : "Facebook / Instagram";
    if (src === "youtube" || src === "yt") return "YouTube";
    return "Other campaign";
  }

  if (a.gclid) return "Google Ads";
  if (a.fbclid) return "Facebook / Instagram Ads";

  const host = (a.referrer_host ?? "").toLowerCase();
  if (!host) return "Direct";
  if (/(^|\.)google\./.test(host)) return "Google Search";
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "YouTube";
  if (/(^|\.)(facebook|instagram)\.com$/.test(host)) return "Facebook / Instagram";
  return "Other website";
}
