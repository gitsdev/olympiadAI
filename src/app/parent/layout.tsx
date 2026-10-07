import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Dashboard — Track Your Child's Olympiad Prep | OlympiadIQ",
  description:
    "Follow your child's Olympiad preparation on OlympiadIQ — readiness score, subject mastery, study streaks, and upcoming practice sessions and mock tests.",
  alternates: { canonical: "/parent" },
  openGraph: { url: "/parent", title: "Parent Dashboard — Track Your Child's Olympiad Prep | OlympiadIQ", description: "Follow your child's Olympiad preparation on OlympiadIQ — readiness score, subject mastery, study streaks, and upcoming practice sessions and mock tests." },
};

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
