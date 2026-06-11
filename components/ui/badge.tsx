import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "accent" | "danger" | "success" | "muted" }) {
  const tones = {
    default: "border-primary/30 bg-primary/15 text-primary",
    accent: "border-accent/30 bg-accent/15 text-accent",
    danger: "border-destructive/30 bg-destructive/15 text-destructive",
    success: "border-emerald-400/30 bg-emerald-400/15 text-emerald-300",
    muted: "border-border bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}
