import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type { ButtonHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-45 disabled:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/92",
        accent: "bg-accent text-accent-foreground shadow-sm hover:bg-accent-strong",
        outline:
          "border-input bg-surface text-foreground shadow-[0_1px_1px_rgb(20_42_74/0.025)] hover:border-border-strong hover:bg-muted/55",
        secondary: "bg-muted text-foreground hover:bg-muted/75",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive: "bg-danger text-white hover:bg-danger/90",
      },
      size: {
        default: "h-control px-4 py-2",
        sm: "h-control-sm rounded-md px-3 text-xs",
        lg: "h-control-lg rounded-md px-5",
        icon: "size-control",
        "icon-sm": "size-control-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button"

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
