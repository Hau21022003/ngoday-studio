import type { ReactNode } from "react"

function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-5 pl-10 sm:flex-row sm:items-start sm:justify-between lg:pl-0">
      <div className="min-w-0">
        <h1 className="text-page-title tracking-[-0.025em] text-primary text-balance">{title}</h1>
        <p className="mt-0.5 text-sm leading-5 text-muted-foreground text-pretty">{description}</p>
      </div>
      {action}
    </header>
  )
}

export { PageHeader }
