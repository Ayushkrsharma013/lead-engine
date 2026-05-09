import { cn } from "@/lib/utils";
export function Separator({ className, orientation="horizontal" }: { className?: string; orientation?: "horizontal"|"vertical" }) {
  return <div className={cn("bg-white/[0.06]", orientation === "horizontal" ? "h-px w-full" : "w-px h-full", className)} />;
}
