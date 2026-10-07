import { OABadge } from "@/components/ui";
import { STATUS_TONES, humanizeStatus } from "@/lib/seo-agent/constants";

export function StatusBadge({ status }: { status: string }) {
  return <OABadge tone={STATUS_TONES[status] ?? "neutral"}>{humanizeStatus(status)}</OABadge>;
}
