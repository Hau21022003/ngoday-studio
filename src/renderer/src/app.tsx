import { Bell, Command, HelpCircle, Menu, Search } from "lucide-react"
import { useState } from "react"

import { StudioSidebar } from "@/components/studio-sidebar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { WorkspaceOverview } from "@/components/workspace-overview"
import {
  WorkspaceCollection,
  type CollectionSection,
} from "@/components/workspace-collection"

export function App() {
  const [activeItem, setActiveItem] = useState("Tổng quan")
  const [navigationOpen, setNavigationOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border lg:block">
        <StudioSidebar activeItem={activeItem} onNavigate={setActiveItem} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 lg:hidden" aria-label="Mở điều hướng">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Điều hướng NGoDay Studio</SheetTitle>
              <SheetDescription className="sr-only">Chọn khu vực làm việc</SheetDescription>
              <StudioSidebar
                activeItem={activeItem}
                onNavigate={(label) => {
                  setActiveItem(label)
                  setNavigationOpen(false)
                }}
              />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>NGoDay Studio</span>
              <span className="text-border-strong">/</span>
              <span className="truncate font-semibold text-foreground">{activeItem}</span>
            </div>
          </div>

          <button
            type="button"
            className="mr-2 hidden h-9 w-full max-w-64 items-center gap-2 rounded-md border border-border bg-surface px-3 text-left text-xs text-muted-foreground outline-none hover:border-primary/20 focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          >
            <Search className="size-4" />
            <span className="flex-1">Tìm tập phim, cảnh...</span>
            <kbd className="flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">
              <Command className="size-2.5" />K
            </kbd>
          </button>

          <Button variant="ghost" size="icon" aria-label="Trợ giúp">
            <HelpCircle />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Thông báo" className="relative">
            <Bell />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent ring-2 ring-background" />
          </Button>
        </header>

        <main>
          {activeItem === "Tổng quan" ? (
            <WorkspaceOverview />
          ) : (
            <WorkspaceCollection section={activeItem as CollectionSection} />
          )}
        </main>
      </div>
    </div>
  )
}
