import {
  Archive,
  BookOpenText,
  Clapperboard,
  LayoutGrid,
  Library,
  ListVideo,
  Settings,
  Sparkles,
} from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Icon = ComponentType<SVGProps<SVGSVGElement>>

type NavItem = {
  label: string
  icon: Icon
  badge?: string
  disabled?: boolean
}

const mainNavigation: NavItem[] = [
  { label: "Tổng quan", icon: LayoutGrid },
  { label: "Tập phim", icon: Clapperboard, badge: "6" },
  { label: "Kịch bản", icon: BookOpenText },
  { label: "Prompt mẫu", icon: Sparkles },
]

const studioNavigation: NavItem[] = [
  { label: "Hàng đợi", icon: ListVideo, disabled: true },
  { label: "Thư viện media", icon: Library, disabled: true },
  { label: "Bản xuất", icon: Archive, disabled: true },
]

type StudioSidebarProps = {
  activeItem: string
  onNavigate: (label: string) => void
}

function NavigationGroup({
  label,
  items,
  activeItem,
  onNavigate,
}: StudioSidebarProps & { label: string; items: NavItem[] }) {
  return (
    <div>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
        {label}
      </p>
      <nav className="space-y-0.5" aria-label={label}>
        {items.map((item) => {
          const active = item.label === activeItem
          const Icon = item.icon

          return (
            <button
              key={item.label}
              type="button"
              aria-current={active ? "page" : undefined}
              disabled={item.disabled}
              onClick={() => onNavigate(item.label)}
              className={cn(
                "group relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "bg-primary/7 text-primary"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
              <Icon className={cn("size-[18px]", active ? "text-primary" : "text-muted-foreground")} />
              <span className="flex-1">{item.label}</span>
              {item.badge && <Badge className="px-1.5">{item.badge}</Badge>}
              {item.disabled && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/70">
                  Sau
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export function StudioSidebar({ activeItem, onNavigate }: StudioSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-surface px-3 py-4">
      <div className="flex items-center gap-3 px-2 pb-6">
        <div className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-black tracking-tight text-primary-foreground">
          NG
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-foreground">NGoDay Studio</p>
          <p className="truncate text-[11px] text-muted-foreground">Production workspace</p>
        </div>
      </div>

      <div className="mb-5 px-2">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md border border-border bg-background px-2.5 py-2 text-left outline-none hover:border-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="size-2 rounded-full bg-success" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-foreground">Studio chính</span>
            <span className="block truncate text-[10px] text-muted-foreground">Lưu cục bộ trên máy này</span>
          </span>
        </button>
      </div>

      <div className="space-y-6">
        <NavigationGroup
          label="Chuẩn bị"
          items={mainNavigation}
          activeItem={activeItem}
          onNavigate={onNavigate}
        />
        <NavigationGroup
          label="Sản xuất"
          items={studioNavigation}
          activeItem={activeItem}
          onNavigate={onNavigate}
        />
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <button
          type="button"
          className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Settings className="size-[18px]" />
          Cài đặt
        </button>
        <div className="mt-2 flex items-center gap-3 rounded-md px-3 py-2">
          <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">HN</div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">Hậu Nguyễn</p>
            <p className="truncate text-[10px] text-muted-foreground">Workspace owner</p>
          </div>
        </div>
      </div>
    </div>
  )
}
