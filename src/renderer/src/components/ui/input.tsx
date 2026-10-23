import type { InputHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type InputProps = InputHTMLAttributes<HTMLInputElement>

function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-control w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground shadow-[0_1px_1px_rgb(20_42_74/0.02)] transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/65 focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
