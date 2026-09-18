import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  Icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--paper-2)" }}
      >
        <Icon size={22} style={{ color: "var(--fg-muted)" }} aria-hidden />
      </div>
      <p className="text-[14.5px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</p>
      {description && (
        <p className="text-[13px] mt-1 max-w-sm" style={{ color: "var(--fg-muted)" }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
