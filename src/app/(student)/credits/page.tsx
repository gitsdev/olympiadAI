import { AppShell } from "@/components/layout";
import { MyCredits } from "@/components/credits/MyCredits";

export default function CreditsPage() {
  return (
    <AppShell title="My Credits" subtitle="Buy credits and see where they went">
      <MyCredits />
    </AppShell>
  );
}
