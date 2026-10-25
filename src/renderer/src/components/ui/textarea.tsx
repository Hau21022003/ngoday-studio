import type { TextareaHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

function Textarea({ className, id, name, autoComplete = "off", ...props }: TextareaProps) {
  return (
    <textarea
      id={id}
      name={name ?? id}
      autoComplete={autoComplete}
      className={cn(
        "min-h-24 w-full resize-y rounded-md border border-input bg-surface px-3 py-2 text-sm leading-5 text-foreground shadow-[0_1px_1px_rgb(20_42_74/0.02)] transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/65 focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
