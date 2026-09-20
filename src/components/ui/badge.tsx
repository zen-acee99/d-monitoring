import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline"
  children?: React.ReactNode
  className?: string
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
        {
          "bg-background-tertiary text-text-primary border border-border-primary": variant === "default",
          "bg-status-green/10 text-status-green border border-status-green/20": variant === "success",
          "bg-status-yellow/10 text-status-yellow border border-status-yellow/20": variant === "warning",
          "bg-status-red/10 text-status-red border border-status-red/20": variant === "danger",
          "bg-status-cyan/10 text-status-cyan border border-status-cyan/20": variant === "info",
          "text-text-primary border border-border-primary": variant === "outline",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Badge }

