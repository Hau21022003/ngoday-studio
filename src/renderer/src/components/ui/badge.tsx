import { cva, type VariantProps } from "class-variance-authority"
import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted/70 text-muted-foreground",
        progress: "border-primary/15 bg-primary/7 text-primary",
        attention: "border-accent/20 bg-accent-soft text-accent-strong",
        success: "border-success/20 bg-success-soft text-success",
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
