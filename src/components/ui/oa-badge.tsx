import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const oaBadgeVariants = cva(
  "inline-flex items-center gap-1 font-semibold rounded-full whitespace-nowrap px-2.5 py-1 text-xs [&_svg]:size-[13px] [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        cobalt:  "bg-[var(--cobalt-50)]  text-[var(--cobalt-700)]",
        gold:    "bg-[var(--gold-100)]   text-[var(--gold-700)]",
        green:   "bg-[var(--success-bg)] text-[var(--success-tx)]",
        red:     "bg-[var(--danger-bg)]  text-[var(--danger-tx)]",
        amber:   "bg-[var(--warning-bg)] text-[var(--warning-tx)]",
        neutral: "bg-[var(--fill-100)]   text-[var(--ink-700)]",
        outline: "bg-transparent text-[var(--ink-700)] border border-[var(--line-300)]",
      },
    },
    defaultVariants: {
      tone: "cobalt",
    },
  }
);

export interface OABadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof oaBadgeVariants> {}

function OABadge({ className, tone, children, ...props }: OABadgeProps) {
  return (
    <span className={cn(oaBadgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}

export { OABadge, oaBadgeVariants };
