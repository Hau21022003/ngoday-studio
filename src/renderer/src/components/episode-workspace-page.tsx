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
import { useEffect, useRef, useState, type MouseEvent } from "react"

import type { EpisodeAggregate } from "../../../shared/domain"
import { EpisodeAssetsTab } from "@/components/episode-assets-tab"
import { topics, workflowStatuses } from "@/components/episode-data"
import { EpisodeScenesTab } from "@/components/episode-scenes-tab"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ErrorState, LoadingState } from "@/components/ui/state-feedback"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, localActorName, unwrapResult } from "@/data/studio-client"
import { useSingleFlightAutosave, type AutosaveStatus } from "@/hooks/use-single-flight-autosave"
import { cn } from "@/lib/utils"

type EpisodeWorkspaceTab = "assets" | "overview" | "scenes"

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

function episodeEditHref(episodeId: string) {
  return `${window.location.pathname}?episodeAuthor=edit&episode=${encodeURIComponent(episodeId)}#episodes`
}

function updateWorkspaceUrl(tab: EpisodeWorkspaceTab, episodeId: string) {
  const url = new URL(window.location.href)
  url.searchParams.delete("episodeAuthor")
  url.searchParams.set("episodeWorkspace", tab)
  url.searchParams.set("episode", episodeId)
  url.hash = "episodes"
  window.history.replaceState(null, "", url)
}

function workspaceHref(tab: EpisodeWorkspaceTab, episodeId: string) {
  const params = new URLSearchParams()
  params.set("episodeWorkspace", tab)
  params.set("episode", episodeId)
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

function EpisodeInformation({ episode }: { episode: EpisodeAggregate }) {
  const rows = [
    { label: "Chủ đề", value: <Badge variant="attention">{topics[episode.topic].label}</Badge> },
    { label: "Trạng thái", value: <span className="inline-flex items-center gap-2 font-semibold text-success"><span aria-hidden="true" className="size-2 rounded-full bg-success" />{workflowStatuses[episode.workflowStatus].label}</span> },
    { label: "Số cảnh", value: <span className="inline-flex items-center gap-2"><Clapperboard aria-hidden="true" className="size-4" />{episode.sceneCount} cảnh</span> },
    { label: "Tạo lúc", value: <time dateTime={episode.createdAt} className="inline-flex items-center gap-2 tabular-nums"><CalendarDays aria-hidden="true" className="size-4" />{dateTimeFormatter.format(new Date(episode.createdAt))}</time> },
    { label: "Cập nhật gần nhất", value: <time dateTime={episode.updatedAt} className="inline-flex items-center gap-2 tabular-nums"><Clock3 aria-hidden="true" className="size-4" />{dateTimeFormatter.format(new Date(episode.updatedAt))}</time> },
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

function ProductionProgress({ episode }: { episode: EpisodeAggregate }) {
  const hasScenes = episode.sceneCount > 0
  const steps = [
    { label: "Scenes", detail: hasScenes ? "Đang thực hiện" : "Chưa bắt đầu", dot: hasScenes ? "bg-warning" : "bg-border-strong", text: hasScenes ? "text-warning" : "text-muted-foreground" },
    { label: "Assets", detail: episode.productionProgress > 0 ? "Đang thực hiện" : "Chưa bắt đầu", dot: episode.productionProgress > 0 ? "bg-warning" : "bg-border-strong", text: episode.productionProgress > 0 ? "text-warning" : "text-muted-foreground" },
  ]

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="production-progress-title">
      <div id="production-progress-title"><SectionHeading icon={Target}>Tiến độ sản xuất</SectionHeading></div>
      <div className="mt-4 flex items-center gap-4">
        <div role="progressbar" aria-label="Tiến độ sản xuất" aria-valuemin={0} aria-valuemax={100} aria-valuenow={episode.productionProgress} className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-warning" style={{ width: `${episode.productionProgress}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-primary">{episode.productionProgress}%</span>
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

function QuickActions({ episodeId }: { episodeId: string }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="quick-actions-title">
      <div id="quick-actions-title"><SectionHeading icon={Zap}>Thao tác nhanh</SectionHeading></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <a key={action.tab} href={workspaceHref(action.tab, episodeId)} className="group flex min-w-0 items-center gap-2.5 rounded-md border border-border bg-surface p-3 text-left hover:border-selected-border hover:bg-accent-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 2xl:items-start">
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

function autosaveLabel(status: AutosaveStatus, error: unknown) {
  if (status === "saving") return "Đang lưu ghi chú…"
  if (status === "dirty") return "Có thay đổi chưa lưu"
  if (status === "saved") return "Đã lưu"
  if (status === "conflict") return "Ghi chú đã thay đổi ở nơi khác. Bản nháp của bạn vẫn được giữ lại."
  if (status === "error") return errorMessage(error, "Không thể lưu ghi chú. Bản nháp của bạn vẫn được giữ lại.")
  return "Ghi chú được tự động lưu"
}

function Overview({ episode, thumbnailUrl, notes, autosaveStatus, autosaveError, onNotesChange, onNotesBlur, onRetryAutosave }: {
  episode: EpisodeAggregate
  thumbnailUrl: string | null
  notes: string
  autosaveStatus: AutosaveStatus
  autosaveError: unknown
  onNotesChange: (value: string) => void
  onNotesBlur: () => void
  onRetryAutosave: () => void
}) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(23rem,1fr)]">
      <div className="min-w-0 space-y-4">
        <figure className="relative aspect-video overflow-hidden rounded-lg border border-border bg-primary shadow-panel">
          <img src={thumbnailUrl ?? "/episode-thumbnails/peaceful-moments.png"} alt={`Thumbnail ${episode.title}`} width={1672} height={941} fetchPriority="high" className="h-full w-full object-cover" />
          <figcaption className="absolute bottom-[14%] right-[5%] max-w-[55%] text-right text-white [text-shadow:0_2px_12px_rgb(9_27_58/0.45)]">
            <span className="inline-flex rounded-full border border-white/70 bg-primary/15 px-3 py-1 text-xs font-semibold">Episode</span>
            <span className="mt-3 block text-3xl font-bold tracking-[-0.035em] text-balance sm:text-5xl">{episode.title}</span>
          </figcaption>
        </figure>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="episode-description-title">
          <div id="episode-description-title"><SectionHeading icon={FileText}>Mô tả tập phim</SectionHeading></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">{episode.description}</p>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="episode-notes-title">
          <div id="episode-notes-title"><SectionHeading icon={NotebookPen}>Ghi chú</SectionHeading></div>
          <label htmlFor="workspace-notes" className="sr-only">Ghi chú cho tập phim</label>
          <Textarea id="workspace-notes" name="workspace-notes" autoComplete="off" value={notes} maxLength={240} className="mt-3 min-h-16 bg-accent-soft/40 text-sm" placeholder="Nhập ghi chú cho tập phim này…" onChange={(event) => onNotesChange(event.target.value)} onBlur={onNotesBlur} />
          <div className="mt-2 flex min-h-7 items-center justify-between gap-3" aria-live="polite">
            <p className={cn("text-[11px]", autosaveStatus === "error" || autosaveStatus === "conflict" ? "text-danger" : "text-muted-foreground")}>{autosaveLabel(autosaveStatus, autosaveError)}</p>
            {(autosaveStatus === "error" || autosaveStatus === "conflict") && (
              <Button type="button" variant="outline" size="sm" onClick={onRetryAutosave}>
                {autosaveStatus === "conflict" ? "Đồng bộ và lưu lại" : "Thử lưu lại"}
              </Button>
            )}
          </div>
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        <EpisodeInformation episode={episode} />
        <ProductionProgress episode={episode} />
        <QuickActions episodeId={episode.id} />
      </div>
    </div>
  )
}

function EpisodeWorkspacePage({ initialTab, episodeId }: { initialTab: EpisodeWorkspaceTab; episodeId?: string }) {
  const [activeTab, setActiveTab] = useState<EpisodeWorkspaceTab>(initialTab)
  const [assetExportRequest, setAssetExportRequest] = useState(0)
  const [episode, setEpisode] = useState<EpisodeAggregate | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [sceneDirty, setSceneDirty] = useState(false)
  const [pendingTab, setPendingTab] = useState<EpisodeWorkspaceTab | null>(null)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const loadRequest = useRef(0)

  const autosave = useSingleFlightAutosave<string>({
    initialRevisionNo: episode?.revisionNo ?? 0,
    delayMs: 750,
    save: async (value, expectedRevisionNo) => {
      if (!episodeId) throw new Error("Thiếu mã episode.")
      const updated = await unwrapResult(window.studio.episodes.update({ id: episodeId, expectedRevisionNo, updatedByName: localActorName, patch: { notes: value } }))
      setEpisode((current) => current ? { ...current, ...updated } : current)
      return { revisionNo: updated.revisionNo }
    },
  })

  function loadEpisode() {
    const requestId = ++loadRequest.current
    setLoadState("loading")
    setThumbnailUrl(null)
    void (async () => {
      try {
        if (!episodeId) throw new Error("Thiếu mã episode.")
        const aggregate = await unwrapResult(window.studio.episodes.get({ id: episodeId }))
        let nextThumbnailUrl: string | null = null
        if (aggregate.thumbnailRelativePath) {
          const thumbnail = await unwrapResult(window.studio.episodeThumbnails.read({ relativePath: aggregate.thumbnailRelativePath }))
          nextThumbnailUrl = thumbnail.dataUrl
        }
        if (requestId !== loadRequest.current) return
        setEpisode(aggregate)
        setNotes(aggregate.notes)
        setThumbnailUrl(nextThumbnailUrl)
        setLoadState("ready")
      } catch {
        if (requestId === loadRequest.current) setLoadState("error")
      }
    })()
  }

  useEffect(loadEpisode, [episodeId])

  useEffect(() => {
    if (!autosave.dirty && !sceneDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [autosave.dirty, sceneDirty])

  useEffect(() => {
    if (!sceneDirty) return
    const handleAnchorNavigation = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!target || target.target || target.hasAttribute("download") || target.href === window.location.href) return
      event.preventDefault()
      event.stopPropagation()
      setPendingHref(target.href)
    }
    document.addEventListener("click", handleAnchorNavigation, true)
    return () => document.removeEventListener("click", handleAnchorNavigation, true)
  }, [sceneDirty])

  async function performTabNavigation(tab: EpisodeWorkspaceTab) {
    await autosave.flush()
    setActiveTab(tab)
    if (episodeId) updateWorkspaceUrl(tab, episodeId)
  }

  function navigateTab(tab: EpisodeWorkspaceTab) {
    if (activeTab === "scenes" && sceneDirty && tab !== "scenes") {
      setPendingTab(tab)
      return
    }
    void performTabNavigation(tab)
  }

  function guardDirtyNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (sceneDirty) {
      event.preventDefault()
      setPendingHref(event.currentTarget.href)
      return
    }
    if (!autosave.dirty) return
    event.preventDefault()
    void autosave.flush()
  }

  async function refreshWorkspaceEpisode() {
    if (!episodeId) throw new Error("Thiếu mã episode.")
    const latest = await unwrapResult(window.studio.episodes.get({ id: episodeId }))
    setEpisode(latest)
    autosave.updateRevision(latest.revisionNo)
    return latest
  }

  async function prepareEpisodeMutation() {
    const notesSaved = await autosave.flush()
    if (!notesSaved) {
      throw new Error("Không thể tiếp tục khi ghi chú Episode còn xung đột hoặc chưa lưu được. Hãy xử lý ghi chú rồi thử lại.")
    }
    return refreshWorkspaceEpisode()
  }

  async function retryAutosave() {
    if (autosave.status === "conflict" && episodeId) {
      try {
        const latest = await unwrapResult(window.studio.episodes.get({ id: episodeId }))
        setEpisode(latest)
        autosave.updateRevision(latest.revisionNo)
      } catch {
        return
      }
    }
    await autosave.retry()
  }

  if (loadState === "loading") return <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7"><LoadingState /></div>
  if (loadState === "error" || !episode) return <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7"><ErrorState onRetry={loadEpisode} /></div>

  return (
    <>
    <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
      <header className="pl-10 lg:pl-0">
        <nav aria-label="Breadcrumb">
          <ol className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <li><a href={episodeListHref()} onClick={guardDirtyNavigation} className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">Episodes</a></li>
            <li aria-hidden="true" className="text-border-strong">/</li>
            <li aria-current="page" className="truncate font-medium text-primary">{episode.title}</li>
          </ol>
        </nav>

        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tập phim</p>
            <div className="mt-1.5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <h1 className="text-page-title tracking-[-0.025em] text-primary text-balance">{episode.title}</h1>
              <Badge variant="success" className="h-7 shrink-0 px-3 text-xs">
                <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                {workflowStatuses[episode.workflowStatus].label}
                <ChevronDown aria-hidden="true" className="size-3" />
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start xl:self-auto">
            {activeTab === "assets" ? (
              <Button type="button" variant="accent" size="lg" onClick={() => setAssetExportRequest((value) => value + 1)}><Download aria-hidden="true" />Xuất media</Button>
            ) : (
              <Button asChild variant="accent" size="lg"><a href={episodeEditHref(episode.id)} onClick={guardDirtyNavigation}><Pencil aria-hidden="true" />Chỉnh sửa</a></Button>
            )}
            <WorkspaceMenu />
          </div>
        </div>
      </header>

      <div className="mt-5 overflow-x-auto">
        <Tabs items={tabItems} value={activeTab} onValueChange={navigateTab} ariaLabel="Khu vực episode" panelId="episode-workspace-panel" className="[&_button]:flex [&_button]:items-center [&_button]:gap-2 sm:[&_button]:min-w-36 sm:[&_button]:justify-center" />
      </div>

      <main id="episode-workspace-panel" role="tabpanel" aria-labelledby={`episode-workspace-panel-${activeTab}-tab`} className="mt-5">
        {activeTab === "overview" ? (
          <Overview
            episode={episode}
            thumbnailUrl={thumbnailUrl}
            notes={notes}
            autosaveStatus={autosave.status}
            autosaveError={autosave.error}
            onNotesChange={(value) => {
              setNotes(value)
              autosave.schedule(value)
            }}
            onNotesBlur={() => void autosave.flush()}
            onRetryAutosave={() => void retryAutosave()}
          />
        ) : activeTab === "scenes" ? (
          <EpisodeScenesTab
            episode={episode}
            prepareEpisodeMutation={prepareEpisodeMutation}
            refreshEpisode={refreshWorkspaceEpisode}
            onDirtyChange={setSceneDirty}
          />
        ) : <EpisodeAssetsTab exportRequest={assetExportRequest} />}
      </main>
    </div>
    <ConfirmDialog
      open={pendingTab !== null || pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPendingTab(null)
          setPendingHref(null)
        }
      }}
      title="Bỏ thay đổi Scene chưa lưu?"
      description="Bản nháp Scene hoặc thứ tự đang chỉnh sẽ bị bỏ khi rời tab Scenes."
      cancelLabel="Tiếp tục chỉnh sửa"
      confirmLabel="Bỏ thay đổi"
      onConfirm={() => {
        const tab = pendingTab
        const href = pendingHref
        setPendingTab(null)
        setPendingHref(null)
        setSceneDirty(false)
        if (tab) void performTabNavigation(tab)
        else if (href) window.location.assign(href)
      }}
    />
    </>
  )
}

export { EpisodeWorkspacePage }
export type { EpisodeWorkspaceTab }
