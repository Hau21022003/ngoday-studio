import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

function Field({
  label,
  htmlFor,
  required,
  description,
  error,
  meta,
  children,
  className,
}: {
  label: string
  htmlFor: string
  required?: boolean
  description?: ReactNode
  error?: string
  meta?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-accent-strong">
              *
            </span>
          )}
        </label>
        {meta && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{meta}</span>}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[11px] leading-4 text-danger">
          {error}
        </p>
      ) : description ? (
        <div id={`${htmlFor}-description`} className="text-[11px] leading-4 text-muted-foreground">
          {description}
        </div>
      ) : null}
    </div>
  )
}

export { Field }
