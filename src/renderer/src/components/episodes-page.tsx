import { Clapperboard, Ellipsis, Plus } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import type { EpisodeTopic, EpisodeWorkflowStatus } from "../../../shared/domain"

import { EpisodeAuthoringPage, type EpisodeAuthoringMode } from "@/components/episode-authoring-page"
import {
  thumbnailStyles,
  toEpisodeRecord,
  topics,
  workflowStatuses,
  type EpisodeRecord,
  type EpisodeThumbnailKind,
} from "@/components/episode-data"
import { EpisodeWorkspacePage, type EpisodeWorkspaceTab } from "@/components/episode-workspace-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DataTable,
  type DataTableColumn,
  type DataTableSorting,
} from "@/components/ui/data-table"
import { PageHeader } from "@/components/ui/page-header"
import { SearchField } from "@/components/ui/search-field"
import { Select } from "@/components/ui/select"
import { StateFeedback } from "@/components/ui/state-feedback"
import { StatusBadge } from "@/components/ui/status-badge"
import { errorMessage, localActorName, unwrapResult } from "@/data/studio-client"
import { cn } from "@/lib/utils"

type DemoState = "empty" | "error" | "loading" | "ready"
type SortOption = "scenes-desc" | "title-asc" | "updated-asc" | "updated-desc"

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
})

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
})

function formatDateTime(value: string) {
  const date = new Date(value)
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`
}

function EpisodeThumbnail({ kind }: { kind: EpisodeThumbnailKind }) {
  const style = thumbnailStyles[kind]
  const Icon = style.icon

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid h-12 w-[72px] shrink-0 place-items-center overflow-hidden rounded-md border border-black/5",
        style.background,
      )}
    >
      <span className={cn("absolute -right-3 -top-4 size-10 rounded-full opacity-70", style.ornament)} />
      <span className="absolute inset-x-0 bottom-0 h-2 bg-black/10" />
      <Icon className="relative size-6 text-surface" strokeWidth={1.65} />
    </span>
  )
}

function TopicBadge({ topic }: { topic: EpisodeTopic }) {
  const presentation = topics[topic]
  const Icon = presentation.icon

  return (
    <Badge variant={presentation.tone}>
      <Icon aria-hidden="true" className="size-3" />
      {presentation.label}
    </Badge>
  )
}

function getEpisodeAuthorHref(mode: EpisodeAuthoringMode, episodeId?: string) {
  const params = new URLSearchParams()
  params.set("episodeAuthor", mode)
  if (episodeId) params.set("episode", episodeId)
  return `${window.location.pathname}?${params.toString()}#episodes`
}

function getEpisodeWorkspaceHref(tab: EpisodeWorkspaceTab, episodeId: string) {
  const params = new URLSearchParams()
  params.set("episodeWorkspace", tab)
  params.set("episode", episodeId)
  return `${window.location.pathname}?${params.toString()}#episodes`
}

function EpisodeActions({ episode, onArchive }: { episode: EpisodeRecord; onArchive: () => void }) {
  return (
    <details className="group/actions relative inline-block text-left">
      <summary
        aria-label={`Mở thao tác cho ${episode.title}`}
        className="grid size-8 list-none place-items-center rounded-md border border-input bg-surface text-muted-foreground shadow-[0_1px_1px_rgb(20_42_74/0.025)] transition-[border-color,background-color,color] hover:border-border-strong hover:bg-muted/55 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 [&::-webkit-details-marker]:hidden"
      >
        <Ellipsis aria-hidden="true" className="size-4" />
      </summary>
      <div
        role="menu"
        aria-label={`Thao tác cho ${episode.title}`}
        className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-surface p-1 text-left shadow-overlay"
      >
        <a
          href={getEpisodeWorkspaceHref("overview", episode.id)}
          role="menuitem"
          className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          Mở workspace
        </a>
        <a
          href={getEpisodeAuthorHref("edit", episode.id)}
          role="menuitem"
          className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          Chỉnh sửa
        </a>
        <button
          type="button"
          role="menuitem"
          className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          onClick={onArchive}
        >
          Lưu trữ
        </button>
      </div>
    </details>
  )
}

const episodeColumns: readonly DataTableColumn<EpisodeRecord>[] = [
  {
    id: "thumbnail",
    header: "Thumbnail",
    width: "10%",
    headerClassName: "px-2",
    className: "px-2 py-2",
    cell: (episode) => <EpisodeThumbnail kind={episode.thumbnail} />,
  },
  {
    id: "title",
    header: "Tiêu đề",
    width: "25%",
    sortValue: (episode) => episode.title,
    sortable: false,
    searchableValue: (episode) => episode.title,
    className: "py-2",
    cell: (episode) => (
      <span className="line-clamp-2 max-w-80 font-bold leading-[1.3] text-primary text-pretty">
        {episode.title}
      </span>
    ),
  },
  {
    id: "topic",
    header: "Chủ đề",
    width: "15%",
    searchableValue: (episode) => topics[episode.topic].label,
    className: "py-2",
    cell: (episode) => <TopicBadge topic={episode.topic} />,
  },
  {
    id: "status",
    header: "Trạng thái",
    width: "16%",
    searchableValue: (episode) => workflowStatuses[episode.status].label,
    className: "py-2",
    cell: (episode) => {
      const status = workflowStatuses[episode.status]
      return <StatusBadge label={status.label} tone={status.tone} />
    },
  },
  {
    id: "sceneCount",
    header: "Số cảnh",
    width: "8%",
    align: "center",
    sortValue: (episode) => episode.sceneCount,
    sortable: false,
    className: "py-2 font-medium tabular-nums text-muted-foreground",
    cell: (episode) => episode.sceneCount,
  },
  {
    id: "updatedAt",
    header: "Cập nhật gần nhất",
    width: "26%",
    sortValue: (episode) => episode.updatedAt,
    searchableValue: (episode) => episode.updatedBy,
    className: "py-2",
    cell: (episode) => (
      <span className="block min-w-0 leading-4">
        <time dateTime={episode.updatedAt} className="block font-medium tabular-nums text-primary">
          {formatDateTime(episode.updatedAt)}
        </time>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">Bởi {episode.updatedBy}</span>
      </span>
    ),
  },
]

function getDemoState(): DemoState {
  const value = new URLSearchParams(window.location.search).get("demo")
  return value === "empty" || value === "error" || value === "loading" ? value : "ready"
}

function getSearchParam<TValue extends string>(name: string, allowed: readonly TValue[], fallback: TValue) {
  const value = new URLSearchParams(window.location.search).get(name)
  return value && allowed.includes(value as TValue) ? (value as TValue) : fallback
}

function sortingFromOption(value: SortOption): DataTableSorting {
  if (value === "title-asc") return { columnId: "title", direction: "asc" }
  if (value === "scenes-desc") return { columnId: "sceneCount", direction: "desc" }
  return { columnId: "updatedAt", direction: value === "updated-asc" ? "asc" : "desc" }
}

function EpisodesPage() {
  const [authoringMode] = useState<EpisodeAuthoringMode | null>(() => {
    const value = new URLSearchParams(window.location.search).get("episodeAuthor")
    return value === "create" || value === "edit" ? value : null
  })
  const [workspaceTab] = useState<EpisodeWorkspaceTab | null>(() => {
    const value = new URLSearchParams(window.location.search).get("episodeWorkspace")
    return value === "overview" || value === "scenes" || value === "assets"
      ? value
      : null
  })
  const episodeId = new URLSearchParams(window.location.search).get("episode") ?? undefined
  const [episodes, setEpisodes] = useState<EpisodeRecord[]>([])
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [archiveCandidate, setArchiveCandidate] = useState<EpisodeRecord | null>(null)
  const [archiveError, setArchiveError] = useState("")
  const [archiving, setArchiving] = useState(false)
  const listRequestRef = useRef(0)
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("episodeQ") ?? "")
  const [status, setStatus] = useState<"all" | EpisodeWorkflowStatus>(() =>
    getSearchParam("episodeStatus", ["all", ...Object.keys(workflowStatuses)] as Array<"all" | EpisodeWorkflowStatus>, "all"),
  )
  const [topic, setTopic] = useState<"all" | EpisodeTopic>(() =>
    getSearchParam("episodeTopic", ["all", ...Object.keys(topics)] as Array<"all" | EpisodeTopic>, "all"),
  )
  const [sort, setSort] = useState<SortOption>(() =>
    getSearchParam(
      "episodeSort",
      ["updated-desc", "updated-asc", "title-asc", "scenes-desc"] as SortOption[],
      "updated-desc",
    ),
  )
  const [demoState, setDemoState] = useState<DemoState>(getDemoState)

  const loadEpisodes = useCallback(async () => {
    const request = ++listRequestRef.current
    setLoadState("loading")
    try {
      const page = await unwrapResult(window.studio.episodes.list({ page: 1, pageSize: 100 }))
      if (request !== listRequestRef.current) return
      setEpisodes(page.items.map(toEpisodeRecord))
      setLoadState("ready")
    } catch {
      if (request !== listRequestRef.current) return
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    void loadEpisodes()
  }, [loadEpisodes])

  useEffect(() => {
    const url = new URL(window.location.href)
    query ? url.searchParams.set("episodeQ", query) : url.searchParams.delete("episodeQ")
    status !== "all" ? url.searchParams.set("episodeStatus", status) : url.searchParams.delete("episodeStatus")
    topic !== "all" ? url.searchParams.set("episodeTopic", topic) : url.searchParams.delete("episodeTopic")
    sort !== "updated-desc" ? url.searchParams.set("episodeSort", sort) : url.searchParams.delete("episodeSort")
    window.history.replaceState(null, "", url)
  }, [query, sort, status, topic])

  const filterEpisode = useCallback(
    (episode: EpisodeRecord) =>
      (status === "all" || episode.status === status) &&
      (topic === "all" || episode.topic === topic),
    [status, topic],
  )

  function retryDemoState() {
    setDemoState("ready")
    const url = new URL(window.location.href)
    url.searchParams.delete("demo")
    window.history.replaceState(null, "", url)
    void loadEpisodes()
  }

  async function archiveEpisode() {
    if (archiving || !archiveCandidate) return
    setArchiving(true)
    setArchiveError("")
    try {
      await unwrapResult(window.studio.episodes.archive({
        id: archiveCandidate.id,
        expectedRevisionNo: archiveCandidate.revisionNo,
        updatedByName: localActorName,
      }))
      setEpisodes((current) => current.filter((episode) => episode.id !== archiveCandidate.id))
      setArchiveCandidate(null)
    } catch (error) {
      setArchiveError(errorMessage(error, "Không thể lưu trữ Episode."))
    } finally {
      setArchiving(false)
    }
  }

  if (authoringMode) {
    return <EpisodeAuthoringPage mode={authoringMode} episodeId={episodeId} />
  }

  if (workspaceTab) {
    return <EpisodeWorkspacePage initialTab={workspaceTab} episodeId={episodeId} />
  }

  return (
    <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
      <PageHeader
        title="Episodes"
        description="Quản lý các episode video YouTube và theo dõi tiến độ sản xuất."
        action={
          <Button
            asChild
            variant="accent"
            size="lg"
          >
            <a href={getEpisodeAuthorHref("create")}>
              <Plus aria-hidden="true" />
              Tạo episode mới
            </a>
          </Button>
        }
      />

      <section aria-label="Danh sách episode" className="mt-6">
        <DataTable
          caption="Danh sách episode video YouTube"
          columns={episodeColumns}
          data={demoState === "empty" ? [] : episodes}
          getRowId={(episode) => episode.id}
          getRowLabel={(episode) => episode.title}
          globalFilter={query}
          filterFn={filterEpisode}
          sorting={sortingFromOption(sort)}
          isLoading={demoState === "loading" || loadState === "loading"}
          error={demoState === "error" || loadState === "error"}
          onRetry={retryDemoState}
          tableClassName="min-w-[980px]"
          emptyState={
            <StateFeedback
              icon={Clapperboard}
              title="Chưa có episode phù hợp"
              description="Thay đổi từ khóa hoặc bộ lọc để xem các episode khác."
            />
          }
          rowSelection={{ defaultSelectedRowIds: episodes[0] ? [episodes[0].id] : [] }}
          rowActions={(episode) => <EpisodeActions episode={episode} onArchive={() => setArchiveCandidate(episode)} />}
          actionsColumnWidth="72px"
          showActionsHeader
          pagination={{ pageSize: 6, pageSizeOptions: [6], variant: "compact" }}
          labels={{
            showingRows: (from, to, total) => `Hiển thị ${from}–${to} của ${total} episode`,
          }}
          toolbar={
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1.55fr)_minmax(10rem,0.8fr)_minmax(10rem,0.9fr)_minmax(11rem,1.05fr)]">
              <SearchField
                label="Tìm episode"
                name="episode-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm kiếm episode, chủ đề, người cập nhật…"
                className="md:col-span-2 xl:col-span-1"
              />
              <Select
                label="Lọc theo trạng thái"
                name="episode-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as "all" | EpisodeWorkflowStatus)}
              >
                <option value="all">Tất cả trạng thái</option>
                {(Object.entries(workflowStatuses) as Array<[EpisodeWorkflowStatus, { label: string }]>).map(
                  ([value, presentation]) => (
                    <option key={value} value={value}>{presentation.label}</option>
                  ),
                )}
              </Select>
              <Select
                label="Lọc theo chủ đề"
                name="episode-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value as "all" | EpisodeTopic)}
              >
                <option value="all">Tất cả chủ đề</option>
                {(Object.entries(topics) as Array<[EpisodeTopic, { label: string }]>).map(
                  ([value, presentation]) => (
                    <option key={value} value={value}>{presentation.label}</option>
                  ),
                )}
              </Select>
              <Select
                label="Sắp xếp episode"
                name="episode-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
              >
                <option value="updated-desc">Cập nhật gần nhất</option>
                <option value="updated-asc">Cập nhật cũ nhất</option>
                <option value="title-asc">Tiêu đề A–Z</option>
                <option value="scenes-desc">Nhiều cảnh nhất</option>
              </Select>
            </div>
          }
        />
      </section>
      {archiveError && <p role="alert" className="mt-3 text-xs font-medium text-danger">{archiveError}</p>}
      <ConfirmDialog
        open={archiveCandidate !== null}
        onOpenChange={(open) => { if (!open && !archiving) setArchiveCandidate(null) }}
        title="Lưu trữ Episode?"
        description="Episode sẽ ẩn khỏi danh sách mặc định. Scene, Asset và file liên quan không bị xóa."
        cancelLabel="Hủy"
        confirmLabel={archiving ? "Đang lưu trữ…" : "Lưu trữ"}
        onConfirm={() => void archiveEpisode()}
      />
    </div>
  )
}

export { EpisodesPage }
