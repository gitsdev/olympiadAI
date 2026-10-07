import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up Free — AI Olympiad Preparation | OlympiadIQ",
  description:
    "Create your free OlympiadIQ account. AI-powered Olympiad prep for CBSE & ICSE students in Classes 1–10 — IMO, NSO and IEO practice, mock tests and a personal AI tutor.",
  alternates: { canonical: "/signup" },
  openGraph: { url: "/signup", title: "Sign Up Free — AI Olympiad Preparation | OlympiadIQ", description: "Create your free OlympiadIQ account. AI-powered Olympiad prep for CBSE & ICSE students in Classes 1–10 — IMO, NSO and IEO practice, mock tests and a personal AI tutor." },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
