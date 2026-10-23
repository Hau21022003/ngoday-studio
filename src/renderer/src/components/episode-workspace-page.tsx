import {
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Clock3,
  Copy,
  Download,
  Ellipsis,
  FileImage,
  FileText,
  Image as ImageIcon,
  Info,
  NotebookPen,
  Pencil,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

import { EpisodeAssetsTab } from "@/components/episode-assets-tab"
import { EpisodeScenesTab } from "@/components/episode-scenes-tab"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type EpisodeWorkspaceTab = "assets" | "overview" | "scenes"

const workspaceEpisode = {
  id: "peaceful-moments",
  title: "Tập 01: Bình yên từ những điều nhỏ bé",
  description:
    "Tập phim kể về những khoảnh khắc bình dị trong cuộc sống thường ngày, nơi mà hạnh phúc thường đến từ những điều rất nhỏ bé. Thông qua hành trình của nhân vật chính, khán giả sẽ cùng cảm nhận giá trị của sự chậm lại, quan sát và biết ơn những điều giản đơn xung quanh mình.",
  topic: "Cuộc sống thường ngày",
  status: "Đang sản xuất",
  sceneCount: 12,
  createdAt: "2024-06-12T10:24:00+07:00",
  updatedAt: "2024-06-14T16:03:00+07:00",
  progress: 60,
  thumbnail: "/episode-thumbnails/peaceful-moments.png",
} as const

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
})

const tabItems: readonly TabItem<EpisodeWorkspaceTab>[] = [
  { value: "overview", label: <><ImageIcon aria-hidden="true" className="size-4" />Overview</> },
  { value: "scenes", label: <><Clapperboard aria-hidden="true" className="size-4" />Scenes</> },
  { value: "assets", label: <><FileImage aria-hidden="true" className="size-4" />Assets</> },
]

const quickActions: ReadonlyArray<{
  description: string
  icon: LucideIcon
  label: string
  tab: Exclude<EpisodeWorkspaceTab, "overview">
}> = [
  { tab: "scenes", icon: Clapperboard, label: "Quản lý Scenes", description: "Tổ chức và sắp xếp các cảnh" },
  { tab: "assets", icon: FileImage, label: "Quản lý Assets", description: "Xem media và tài nguyên" },
]

function episodeListHref() {
  return `${window.location.pathname}#episodes`
}

function episodeEditHref() {
  return `${window.location.pathname}?episodeAuthor=edit&episode=${workspaceEpisode.id}#episodes`
}

function updateWorkspaceUrl(tab: EpisodeWorkspaceTab) {
  const url = new URL(window.location.href)
  url.searchParams.delete("episodeAuthor")
  url.searchParams.set("episodeWorkspace", tab)
  url.searchParams.set("episode", workspaceEpisode.id)
  url.hash = "episodes"
  window.history.replaceState(null, "", url)
}

function workspaceHref(tab: EpisodeWorkspaceTab) {
  const params = new URLSearchParams()
  params.set("episodeWorkspace", tab)
  params.set("episode", workspaceEpisode.id)
  return `${window.location.pathname}?${params.toString()}#episodes`
}

function WorkspaceMenu() {
  return (
    <details className="group/workspace-menu relative">
      <summary
        aria-label="Mở menu episode"
        className="grid size-control-lg list-none place-items-center rounded-md border border-input bg-surface text-primary shadow-[0_1px_1px_rgb(20_42_74/0.025)] hover:border-border-strong hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 [&::-webkit-details-marker]:hidden"
      >
        <Ellipsis aria-hidden="true" className="size-4" />
      </summary>
      <div role="menu" aria-label="Tùy chọn episode" className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-surface p-1 shadow-overlay">
        <button type="button" role="menuitem" disabled className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-55">
          <Copy aria-hidden="true" className="size-3.5" />Nhân bản
        </button>
        <button type="button" role="menuitem" disabled className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-55">
          <Archive aria-hidden="true" className="size-3.5" />Lưu trữ
        </button>
      </div>
    </details>
  )
}

function SectionHeading({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon aria-hidden="true" className="size-[18px] text-primary" />
      <h2 className="text-section-title text-primary">{children}</h2>
    </div>
  )
}

function EpisodeInformation() {
  const rows = [
    { label: "Chủ đề", value: <Badge variant="attention">{workspaceEpisode.topic}</Badge> },
    { label: "Trạng thái", value: <span className="inline-flex items-center gap-2 font-semibold text-success"><span aria-hidden="true" className="size-2 rounded-full bg-success" />{workspaceEpisode.status}</span> },
    { label: "Số cảnh", value: <span className="inline-flex items-center gap-2"><Clapperboard aria-hidden="true" className="size-4" />{workspaceEpisode.sceneCount} cảnh</span> },
    { label: "Tạo lúc", value: <time dateTime={workspaceEpisode.createdAt} className="inline-flex items-center gap-2 tabular-nums"><CalendarDays aria-hidden="true" className="size-4" />{dateTimeFormatter.format(new Date(workspaceEpisode.createdAt))}</time> },
    { label: "Cập nhật gần nhất", value: <time dateTime={workspaceEpisode.updatedAt} className="inline-flex items-center gap-2 tabular-nums"><Clock3 aria-hidden="true" className="size-4" />{dateTimeFormatter.format(new Date(workspaceEpisode.updatedAt))}</time> },
  ]

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="episode-info-title">
      <div id="episode-info-title"><SectionHeading icon={Info}>Thông tin tập phim</SectionHeading></div>
      <dl className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-center gap-3 py-2.5 text-xs">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ProductionProgress() {
  const steps = [
    { label: "Scenes", detail: "Đang thực hiện", dot: "bg-warning", text: "text-warning" },
    { label: "Assets", detail: "Chưa bắt đầu", dot: "bg-border-strong", text: "text-muted-foreground" },
  ]

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="production-progress-title">
      <div id="production-progress-title"><SectionHeading icon={Target}>Tiến độ sản xuất</SectionHeading></div>
      <div className="mt-4 flex items-center gap-4">
        <div
          role="progressbar"
          aria-label="Tiến độ sản xuất"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={workspaceEpisode.progress}
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-warning" style={{ width: `${workspaceEpisode.progress}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-primary">{workspaceEpisode.progress}%</span>
      </div>
      <div className="mt-4 grid grid-cols-2 divide-x divide-border">
        {steps.map((step) => (
          <div key={step.label} className="flex min-w-0 items-start gap-2 px-3 first:pl-0 last:pr-0">
            <span aria-hidden="true" className={cn("mt-0.5 size-3 shrink-0 rounded-full", step.dot)} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-primary">{step.label}</span>
              <span className={cn("mt-0.5 block truncate text-[11px]", step.text)}>{step.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function QuickActions() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="quick-actions-title">
      <div id="quick-actions-title"><SectionHeading icon={Zap}>Thao tác nhanh</SectionHeading></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <a
              key={action.tab}
              href={workspaceHref(action.tab)}
              className="group flex min-w-0 items-center gap-2.5 rounded-md border border-border bg-surface p-3 text-left hover:border-selected-border hover:bg-accent-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 2xl:items-start"
            >
              <Icon aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-primary">{action.label}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground text-pretty">{action.description}</span>
              </span>
              <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-accent-strong" />
            </a>
          )
        })}
      </div>
    </section>
  )
}

function Overview({ notes, onNotesChange }: { notes: string; onNotesChange: (value: string) => void }) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(23rem,1fr)]">
      <div className="min-w-0 space-y-4">
        <figure className="relative aspect-video overflow-hidden rounded-lg border border-border bg-primary shadow-panel">
          <img
            src={workspaceEpisode.thumbnail}
            alt="Một em nhỏ và chú mèo ngắm hoàng hôn trên ngôi làng miền núi"
            width={1672}
            height={941}
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
          <figcaption className="absolute bottom-[14%] right-[5%] max-w-[50%] text-right text-white [text-shadow:0_2px_12px_rgb(9_27_58/0.45)]">
            <span className="inline-flex rounded-full border border-white/70 bg-primary/15 px-3 py-1 text-xs font-semibold">Tập 01</span>
            <span className="mt-3 block text-3xl font-bold tracking-[-0.035em] text-balance sm:text-5xl">Bình yên</span>
            <span className="mt-1 block text-sm font-semibold sm:text-xl">từ những điều nhỏ bé</span>
          </figcaption>
        </figure>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="episode-description-title">
          <div id="episode-description-title"><SectionHeading icon={FileText}>Mô tả tập phim</SectionHeading></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">{workspaceEpisode.description}</p>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="episode-notes-title">
          <div id="episode-notes-title"><SectionHeading icon={NotebookPen}>Ghi chú</SectionHeading></div>
          <label htmlFor="workspace-notes" className="sr-only">Ghi chú cho tập phim</label>
          <Textarea
            id="workspace-notes"
            name="workspace-notes"
            autoComplete="off"
            value={notes}
            maxLength={240}
            className="mt-3 min-h-16 bg-accent-soft/40 text-sm"
            placeholder="Nhập ghi chú cho tập phim này…"
            onChange={(event) => onNotesChange(event.target.value)}
          />
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        <EpisodeInformation />
        <ProductionProgress />
        <QuickActions />
      </div>
    </div>
  )
}

function EpisodeWorkspacePage({ initialTab }: { initialTab: EpisodeWorkspaceTab }) {
  const [activeTab, setActiveTab] = useState<EpisodeWorkspaceTab>(initialTab)
  const [assetExportRequest, setAssetExportRequest] = useState(0)
  const [notes, setNotes] = useState("")
  const [notesDirty, setNotesDirty] = useState(false)

  useEffect(() => {
    if (!notesDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [notesDirty])

  function navigateTab(tab: EpisodeWorkspaceTab) {
    setActiveTab(tab)
    updateWorkspaceUrl(tab)
  }

  return (
    <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
      <header className="pl-10 lg:pl-0">
        <nav aria-label="Breadcrumb">
          <ol className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <li><a href={episodeListHref()} className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">Episodes</a></li>
            <li aria-hidden="true" className="text-border-strong">/</li>
            <li aria-current="page" className="truncate font-medium text-primary">{workspaceEpisode.title}</li>
          </ol>
        </nav>

        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tập phim</p>
            <div className="mt-1.5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <h1 className="text-page-title tracking-[-0.025em] text-primary text-balance">{workspaceEpisode.title}</h1>
              <Badge variant="success" className="h-7 shrink-0 px-3 text-xs">
                <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                {workspaceEpisode.status}
                <ChevronDown aria-hidden="true" className="size-3" />
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start xl:self-auto">
            {activeTab === "assets" ? (
              <Button type="button" variant="accent" size="lg" onClick={() => setAssetExportRequest((value) => value + 1)}>
                <Download aria-hidden="true" />Xuất media
              </Button>
            ) : (
              <Button asChild variant="accent" size="lg">
                <a href={episodeEditHref()}><Pencil aria-hidden="true" />Chỉnh sửa</a>
              </Button>
            )}
            <WorkspaceMenu />
          </div>
        </div>
      </header>

      <div className="mt-5 overflow-x-auto">
        <Tabs
          items={tabItems}
          value={activeTab}
          onValueChange={navigateTab}
          ariaLabel="Khu vực episode"
          panelId="episode-workspace-panel"
          className="[&_button]:flex [&_button]:items-center [&_button]:gap-2 sm:[&_button]:min-w-36 sm:[&_button]:justify-center"
        />
      </div>

      <main
        id="episode-workspace-panel"
        role="tabpanel"
        aria-labelledby={`episode-workspace-panel-${activeTab}-tab`}
        className="mt-5"
      >
        {activeTab === "overview" ? (
          <Overview
            notes={notes}
            onNotesChange={(value) => {
              setNotes(value)
              setNotesDirty(true)
            }}
          />
        ) : activeTab === "scenes" ? (
          <EpisodeScenesTab />
        ) : (
          <EpisodeAssetsTab exportRequest={assetExportRequest} />
        )}
      </main>
    </div>
  )
}

export { EpisodeWorkspacePage }
export type { EpisodeWorkspaceTab }
