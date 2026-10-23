import { ChevronDown } from "lucide-react"
import type { SelectHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  labelClassName?: string
}

function Select({ className, label, labelClassName, children, ...props }: SelectProps) {
  return (
    <label className={cn("relative block", labelClassName)}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className={cn(
          "h-control w-full appearance-none rounded-md border border-input bg-surface py-0 pl-3 pr-9 text-sm text-foreground shadow-[0_1px_1px_rgb(20_42_74/0.02)] transition-[border-color,box-shadow] duration-150 focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </label>
  )
}

export { Select }
