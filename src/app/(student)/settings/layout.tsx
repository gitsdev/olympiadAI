import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | OlympiadIQ",
  description:
    "Manage your OlympiadIQ account — subjects, class, password, daily study goal and notification preferences.",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
