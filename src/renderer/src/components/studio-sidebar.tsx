import { Clapperboard, Files, Image, ListVideo, Settings } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type StudioRoute = "episodes" | "templates" | "queue" | "media" | "settings"

type NavItem = {
  label: string
  route: StudioRoute
  icon: LucideIcon
}

const navigation: NavItem[] = [
  { label: "Episodes", route: "episodes", icon: Clapperboard },
  { label: "Templates", route: "templates", icon: Files },
  { label: "Queue", route: "queue", icon: ListVideo },
  { label: "Media", route: "media", icon: Image },
]

function BrandMark() {
  return (
    <span aria-hidden="true" className="relative block size-7 shrink-0">
      <span className="absolute inset-y-0 left-0 w-[18px] rounded-[5px] bg-primary" />
      <span className="absolute bottom-0 right-0 h-[18px] w-[13px] rounded-[4px] bg-primary/90 ring-2 ring-sidebar" />
      <span className="absolute right-0 top-0 size-2.5 rounded-bl-[5px] rounded-tr-[4px] bg-accent" />
    </span>
  )
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <a
      href={`#${item.route}`}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
        active
          ? "bg-accent-soft text-accent-strong"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-0.5 bg-accent" />}
      <Icon aria-hidden="true" className={cn("size-[18px]", active && "text-accent")} />
      <span>{item.label}</span>
    </a>
  )
}

function StudioSidebar({ activeRoute, onNavigate }: { activeRoute: StudioRoute; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar px-3 py-4">
      <a
        href="#templates"
        onClick={onNavigate}
        aria-label="Ngộ Dậy Studio — Templates"
        className="mx-2 flex h-10 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
      >
        <BrandMark />
        <span translate="no" className="truncate text-[15px] font-bold tracking-[-0.015em] text-primary">
          Ngộ Dậy Studio
        </span>
      </a>

      <nav aria-label="Điều hướng chính" className="mt-5 space-y-1">
        {navigation.map((item) => (
          <NavLink key={item.route} item={item} active={activeRoute === item.route} onNavigate={onNavigate} />
        ))}
      </nav>

      <nav aria-label="Thiết lập" className="mt-auto border-t border-border pt-3">
        <NavLink
          item={{ label: "Settings", route: "settings", icon: Settings }}
          active={activeRoute === "settings"}
          onNavigate={onNavigate}
        />
      </nav>
    </div>
  )
}

export { StudioSidebar }
export type { StudioRoute }
