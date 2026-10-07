import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password | OlympiadIQ",
  description:
    "Forgot your OlympiadIQ password? Enter your email address and we'll send you a secure link to reset it and get back to your Olympiad preparation.",
  alternates: { canonical: "/forgot-password" },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
