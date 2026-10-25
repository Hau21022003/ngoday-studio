import type { HTMLAttributes, ReactNode } from "react"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

function DetailPanel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        "min-w-0 border-t border-border bg-surface xl:sticky xl:top-0 xl:max-h-screen xl:min-h-screen xl:overflow-y-auto xl:overscroll-contain xl:border-l xl:border-t-0",
        className,
      )}
      {...props}
    />
  )
}

function DetailPanelHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5", className)} {...props} />
}

function DetailSection({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("px-5 py-4", className)}>
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <h2 className="text-section-title text-foreground text-balance">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function DetailDivider() {
  return <Separator />
}

export { DetailDivider, DetailPanel, DetailPanelHeader, DetailSection }
