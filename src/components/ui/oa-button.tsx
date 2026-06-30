"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const oaButtonVariants = cva(
  // base
  [
    "inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap",
    "font-semibold border border-transparent select-none cursor-pointer",
    "transition-all duration-[120ms]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cobalt-500)] focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:translate-y-px active:scale-[0.99]",
  ],
  {
    variants: {
      variant: {
        /** Cobalt-filled primary CTA */
        primary: [
          "bg-[var(--cobalt-500)] text-white",
          "shadow-[var(--shadow-brand)]",
          "hover:bg-[var(--cobalt-600)]",
          "active:bg-[var(--cobalt-700)]",
        ],
        /** White surface with border */
        secondary: [
          "bg-[var(--surface)] text-[var(--ink-900)] border-[var(--line-300)]",
          "hover:bg-[var(--fill-100)]",
          "active:bg-[var(--fill-200)]",
        ],
        /** No background */
        ghost: [
          "bg-transparent text-[var(--ink-700)]",
          "hover:bg-[var(--fill-100)]",
          "active:bg-[var(--fill-200)]",
        ],
        /** Gold — earned moments, CTAs */
        gold: [
          "bg-[var(--gold-400)] text-[var(--ink-900)]",
          "hover:bg-[var(--gold-500)]",
          "active:bg-[var(--gold-500)]",
        ],
        /** Cobalt tint — soft brand action */
        soft: [
          "bg-[var(--cobalt-50)] text-[var(--cobalt-700)]",
          "hover:bg-[var(--cobalt-100)]",
          "active:bg-[var(--cobalt-200)]",
        ],
        /** Danger */
        danger: [
          "bg-[var(--danger-bg)] text-[var(--danger-tx)] border-[var(--danger)]",
          "hover:bg-[var(--danger)] hover:text-white",
        ],
      },
      size: {
        sm: "h-8 px-3 py-1.5 text-[13px] rounded-[var(--r-md)] [&_svg]:size-[14px]",
        md: "h-10 px-[18px] py-2.5 text-[14px] rounded-[var(--r-md)] [&_svg]:size-[16px]",
        lg: "h-11 px-6 py-3 text-[15.5px] rounded-[var(--r-lg)] [&_svg]:size-[18px]",
        icon: "size-9 rounded-[var(--r-md)] [&_svg]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface OAButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof oaButtonVariants> {}

const OAButton = React.forwardRef<HTMLButtonElement, OAButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(oaButtonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
OAButton.displayName = "OAButton";

export { OAButton, oaButtonVariants };
