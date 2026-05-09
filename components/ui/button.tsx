import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default"|"ghost"|"outline"|"destructive";
  size?: "sm"|"md"|"lg"|"icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant="default", size="md", ...props }, ref) => {
    const v = {
      default: "bg-indigo-500 hover:bg-indigo-600 text-white",
      ghost: "hover:bg-white/5 text-slate-400 hover:text-slate-200",
      outline: "border border-white/10 hover:bg-white/5 text-slate-300",
      destructive: "bg-red-600/20 hover:bg-red-600/30 text-red-400",
    }[variant];
    const s = { sm:"h-7 px-3 text-xs", md:"h-9 px-4 text-sm", lg:"h-10 px-6 text-sm", icon:"h-8 w-8" }[size];
    return (
      <button ref={ref} className={cn("inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none", v, s, className)} {...props} />
    );
  }
);
Button.displayName = "Button";
