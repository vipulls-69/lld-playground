"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "ghost" | "outline" | "destructive";
    size?: "sm" | "icon" | "xs";
  }
>(({ className, variant = "default", size = "sm", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
      variant === "ghost" && "hover:bg-accent/50 text-foreground",
      variant === "outline" && "border border-border bg-transparent hover:bg-accent/50",
      variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      size === "sm" && "h-7 px-2.5 text-xs",
      size === "xs" && "h-6 px-2 text-2xs",
      size === "icon" && "h-7 w-7",
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
