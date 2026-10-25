import { cva, type VariantProps } from "class-variance-authority"
import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-4 tabular-nums",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted/70 text-muted-foreground",
        progress: "border-primary/15 bg-primary/7 text-primary",
        attention: "border-accent/20 bg-accent-soft text-accent-strong",
        success: "border-success/20 bg-success-soft text-success",
        warning: "border-warning/20 bg-warning-soft text-warning",
        info: "border-info/15 bg-info-soft text-info",
        lavender: "border-lavender/15 bg-lavender-soft text-lavender",
        danger: "border-danger/15 bg-danger-soft text-danger",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
)

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
