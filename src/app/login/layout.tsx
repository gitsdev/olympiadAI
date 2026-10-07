import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In | OlympiadIQ",
  description:
    "Log in to OlympiadIQ to continue your Olympiad preparation — AI tutor, adaptive mock tests, practice questions and your readiness score for CBSE & ICSE Classes 1–10.",
  alternates: { canonical: "/login" },
  openGraph: { url: "/login", title: "Log In | OlympiadIQ", description: "Log in to OlympiadIQ to continue your Olympiad preparation — AI tutor, adaptive mock tests, practice questions and your readiness score for CBSE & ICSE Classes 1–10." },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
