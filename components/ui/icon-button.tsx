import * as React from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  notificationDot?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, notificationDot, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center",
          "w-[34px] h-[34px] rounded-lg shrink-0",
          "bg-[var(--surface)] border border-[var(--line)]",
          "hover:border-[var(--line-strong)]",
          "transition-all duration-150",
          "active:translate-y-[0.5px]",
          "focus-visible:outline-none",
          "disabled:opacity-40 disabled:pointer-events-none",
          className
        )}
        {...props}
      >
        {children}
        {notificationDot && (
          <span
            className="absolute -top-[2px] -right-[2px] w-[6px] h-[6px] rounded-full"
            style={{
              backgroundColor: "var(--accent)",
              boxShadow: "0 0 0 2px var(--surface)",
            }}
            aria-hidden="true"
          />
        )}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";
