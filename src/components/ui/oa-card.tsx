import * as React from "react";
import { cn } from "@/lib/utils";

interface OACardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lift shadow + border brighten + translateY(-2px) on hover */
  hover?: boolean;
  /** Remove padding (for image/hero insets) */
  noPadding?: boolean;
}

function OACard({ className, hover = false, noPadding = false, children, ...props }: OACardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--surface)] border border-[var(--line-200)] rounded-[var(--r-lg)] shadow-[var(--shadow-sm)]",
        !noPadding && "p-5",
        hover && [
          "cursor-pointer transition-all duration-[180ms]",
          "hover:shadow-[var(--shadow-md)] hover:border-[var(--cobalt-200)] hover:-translate-y-0.5",
        ],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Section header used inside cards */
function OACardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)} {...props}>
      {children}
    </div>
  );
}

/** Card title using display font */
function OACardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-bold text-[18px] leading-snug tracking-tight", className)}
      style={{ fontFamily: "var(--font-display)" }}
      {...props}
    >
      {children}
    </h3>
  );
}

export { OACard, OACardHeader, OACardTitle };
