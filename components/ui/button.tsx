import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default"|"ghost"|"outline"|"destructive"|"primary"|"accent";
  size?: "sm"|"md"|"lg"|"icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant="default", size="md", ...props }, ref) => {
    const v = {
      default: "bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-2)]",
      ghost: "text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]",
      outline: "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-2)]",
      destructive: "bg-[var(--negative-soft)] text-[var(--negative)] border border-[var(--negative)]/25 hover:bg-[var(--negative-soft)]",
      primary: "bg-[var(--accent)] text-[#0C0D0B] hover:bg-[var(--accent-ink)]",
      accent: "text-[var(--accent)] hover:bg-[var(--accent-soft)]",
    }[variant];
    const s = { sm:"h-7 px-3 text-xs", md:"h-9 px-4 text-sm", lg:"h-10 px-6 text-sm", icon:"h-8 w-8" }[size];
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none active:translate-y-[0.5px]",
          v, s, className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
