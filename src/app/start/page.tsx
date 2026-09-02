import type { Metadata } from "next";
import { Landing } from "./Landing";
import { META } from "./landing-content";

/* ============================================================================
 * /start — Facebook / Instagram Ad landing page
 * Point the ad's "Apply Now" URL at  https://www.olympiadiq.in/start
 * ==========================================================================*/

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
  alternates: { canonical: META.canonicalPath },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: META.canonicalPath,
    siteName: "OlympiadIQ",
    title: META.title,
    description: META.description,
    images: [{ url: META.ogImagePath, width: 1200, height: 630, alt: "Olympiad IQ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: META.title,
    description: META.description,
    images: [META.ogImagePath],
  },
};

export default function StartPage() {
  return <Landing />;
}
