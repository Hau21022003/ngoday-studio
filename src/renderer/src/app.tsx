import { Menu } from "lucide-react"
import { useEffect, useState } from "react"

import { StudioSidebar, type StudioRoute } from "@/components/studio-sidebar"
import { TemplatesPage } from "@/components/templates-page"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { WorkspacePlaceholder } from "@/components/workspace-placeholder"

const routes: StudioRoute[] = ["episodes", "templates", "queue", "media", "settings"]

function getRoute(): StudioRoute {
  const route = window.location.hash.replace("#", "")
  return routes.includes(route as StudioRoute) ? (route as StudioRoute) : "templates"
}

function App() {
  const [activeRoute, setActiveRoute] = useState<StudioRoute>(getRoute)
  const [navigationOpen, setNavigationOpen] = useState(false)

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#templates`)
    }

    const handleRouteChange = () => {
      setActiveRoute(getRoute())
      setNavigationOpen(false)
    }

    window.addEventListener("hashchange", handleRouteChange)
    return () => window.removeEventListener("hashchange", handleRouteChange)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-transform duration-150 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Bỏ qua điều hướng
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar border-r border-border lg:block">
        <StudioSidebar activeRoute={activeRoute} />
      </aside>

      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Mở điều hướng"
            className="fixed left-4 top-5 z-40 bg-surface lg:hidden"
          >
            <Menu aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle className="sr-only">Điều hướng Ngộ Dậy Studio</SheetTitle>
          <SheetDescription className="sr-only">Chọn khu vực làm việc</SheetDescription>
          <StudioSidebar activeRoute={activeRoute} onNavigate={() => setNavigationOpen(false)} />
        </SheetContent>
      </Sheet>

      <main id="main-content" className="min-h-screen scroll-mt-4 lg:pl-sidebar">
        {activeRoute === "templates" ? (
          <TemplatesPage />
        ) : (
          <WorkspacePlaceholder route={activeRoute} />
        )}
      </main>
    </div>
  )
}

export { App }
