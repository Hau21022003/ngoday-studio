import { useRef, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

type TabItem<T extends string> = {
  value: T
  label: string
}

type TabsProps<T extends string> = {
  items: readonly TabItem<T>[]
  value: T
  onValueChange: (value: T) => void
  ariaLabel: string
  panelId: string
  className?: string
}

function Tabs<T extends string>({ items, value, onValueChange, ariaLabel, panelId, className }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return

    event.preventDefault()
    const lastIndex = items.length - 1
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length

    const nextItem = items[nextIndex]
    if (!nextItem) return
    onValueChange(nextItem.value)
    refs.current[nextIndex]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex min-w-max items-center gap-1 border-b border-border", className)}
    >
      {items.map((item, index) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`${panelId}-${item.value}-tab`}
            aria-controls={panelId}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "relative h-10 px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/35",
              active ? "text-accent-strong" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {active && <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" />}
          </button>
        )
      })}
    </div>
  )
}

export { Tabs }
export type { TabItem }
