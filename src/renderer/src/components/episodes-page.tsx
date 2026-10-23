import {
  Atom,
  BrainCircuit,
  Cat,
  Clapperboard,
  Ellipsis,
  HeartPulse,
  Landmark,
  Lightbulb,
  MoonStar,
  Orbit,
  PawPrint,
  Plus,
  Pyramid,
  ScrollText,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DataTable,
  type DataTableColumn,
  type DataTableSorting,
} from "@/components/ui/data-table"
import { PageHeader } from "@/components/ui/page-header"
import { SearchField } from "@/components/ui/search-field"
import { Select } from "@/components/ui/select"
import { StateFeedback } from "@/components/ui/state-feedback"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"

type EpisodeTopic = "animals" | "health" | "history" | "psychology" | "science"
type EpisodeStatus = "complete" | "idea" | "in-progress" | "script-ready"
type EpisodeThumbnailKind = "black-hole" | "cat" | "dejavu" | "history" | "pyramid" | "sleep"
type DemoState = "empty" | "error" | "loading" | "ready"
type SortOption = "scenes-desc" | "title-asc" | "updated-asc" | "updated-desc"

type EpisodeRecord = {
  id: string
  sceneCount: number
  status: EpisodeStatus
  thumbnail: EpisodeThumbnailKind
  title: string
  topic: EpisodeTopic
  updatedAt: string
  updatedBy: string
}

const topics: Record<EpisodeTopic, { icon: LucideIcon; label: string; tone: "danger" | "info" | "lavender" | "success" }> = {
  animals: { icon: PawPrint, label: "Động vật", tone: "success" },
  health: { icon: HeartPulse, label: "Cơ thể", tone: "danger" },
  history: { icon: Landmark, label: "Lịch sử", tone: "lavender" },
  psychology: { icon: BrainCircuit, label: "Tâm lý", tone: "danger" },
  science: { icon: Atom, label: "Khoa học", tone: "info" },
}

const statuses: Record<EpisodeStatus, { label: string; tone: StatusTone }> = {
  complete: { label: "Hoàn thành", tone: "success" },
  idea: { label: "Ý tưởng", tone: "warning" },
  "in-progress": { label: "Đang làm", tone: "info" },
  "script-ready": { label: "Kịch bản xong", tone: "success" },
}

const thumbnailStyles: Record<EpisodeThumbnailKind, { background: string; icon: LucideIcon; ornament: string }> = {
  "black-hole": { background: "bg-primary", icon: Orbit, ornament: "bg-warning" },
  cat: { background: "bg-info-soft", icon: Cat, ornament: "bg-info" },
  dejavu: { background: "bg-primary", icon: BrainCircuit, ornament: "bg-accent" },
  history: { background: "bg-warning-soft", icon: ScrollText, ornament: "bg-danger" },
  pyramid: { background: "bg-accent-soft", icon: Pyramid, ornament: "bg-warning" },
  sleep: { background: "bg-lavender-soft", icon: MoonStar, ornament: "bg-lavender" },
}

const initialEpisodes: readonly EpisodeRecord[] = [
  {
    id: "dejavu",
    sceneCount: 10,
    status: "idea",
    thumbnail: "dejavu",
    title: "Tại sao có cảm giác Déjà vu?",
    topic: "psychology",
    updatedAt: "2026-10-22T14:30:00+07:00",
    updatedBy: "Nguyễn Văn A",
  },
  {
    id: "history-betrayal",
    sceneCount: 12,
    status: "in-progress",
    thumbnail: "history",
    title: "Vì sao bị bạn chết vẫn ta ơn?",
    topic: "history",
    updatedAt: "2026-10-21T16:20:00+07:00",
    updatedBy: "Nguyễn Văn A",
  },
  {
    id: "cats-land-on-feet",
    sceneCount: 8,
    status: "script-ready",
    thumbnail: "cat",
    title: "Tại sao mèo luôn đáp xuống bằng chân?",
    topic: "animals",
    updatedAt: "2026-10-20T11:05:00+07:00",
    updatedBy: "Trần Thị B",
  },
  {
    id: "why-we-dream",
    sceneCount: 14,
    status: "complete",
    thumbnail: "sleep",
    title: "Tại sao chúng ta lại mơ?",
    topic: "health",
    updatedAt: "2026-10-18T09:12:00+07:00",
    updatedBy: "Nguyễn Văn A",
  },
  {
    id: "black-hole",
    sceneCount: 11,
    status: "idea",
    thumbnail: "black-hole",
    title: "Hố đen là gì? Tại sao chúng nuốt chửng mọi thứ?",
    topic: "science",
    updatedAt: "2026-10-16T20:18:00+07:00",
    updatedBy: "Lê Minh C",
  },
  {
    id: "pyramid",
    sceneCount: 15,
    status: "in-progress",
    thumbnail: "pyramid",
    title: "Kim tự tháp được xây như thế nào?",
    topic: "history",
    updatedAt: "2026-10-14T13:45:00+07:00",
    updatedBy: "Nguyễn Văn A",
  },
]

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

function EpisodeActions({ episode }: { episode: EpisodeRecord }) {
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
        {["Mở workspace", "Chỉnh sửa", "Lưu trữ"].map((label) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            disabled
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-55"
            title="Sẽ được triển khai ở bước M3 tiếp theo"
          >
            {label}
          </button>
        ))}
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
    searchableValue: (episode) => statuses[episode.status].label,
    className: "py-2",
    cell: (episode) => {
      const status = statuses[episode.status]
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
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("episodeQ") ?? "")
  const [status, setStatus] = useState<"all" | EpisodeStatus>(() =>
    getSearchParam("episodeStatus", ["all", ...Object.keys(statuses)] as Array<"all" | EpisodeStatus>, "all"),
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
  }

  return (
    <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
      <PageHeader
        title="Episodes"
        description="Quản lý các episode video YouTube và theo dõi tiến độ sản xuất."
        action={
          <Button
            type="button"
            variant="accent"
            size="lg"
            aria-disabled="true"
            title="Luồng tạo episode sẽ được triển khai ở bước tiếp theo"
          >
            <Plus aria-hidden="true" />
            Tạo episode mới
          </Button>
        }
      />

      <section aria-label="Danh sách episode" className="mt-6">
        <DataTable
          caption="Danh sách episode video YouTube"
          columns={episodeColumns}
          data={demoState === "empty" ? [] : initialEpisodes}
          getRowId={(episode) => episode.id}
          getRowLabel={(episode) => episode.title}
          globalFilter={query}
          filterFn={filterEpisode}
          sorting={sortingFromOption(sort)}
          isLoading={demoState === "loading"}
          error={demoState === "error"}
          onRetry={retryDemoState}
          tableClassName="min-w-[980px]"
          emptyState={
            <StateFeedback
              icon={Clapperboard}
              title="Chưa có episode phù hợp"
              description="Thay đổi từ khóa hoặc bộ lọc để xem các episode khác."
            />
          }
          rowSelection={{ defaultSelectedRowIds: ["dejavu"] }}
          rowActions={(episode) => <EpisodeActions episode={episode} />}
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
                onChange={(event) => setStatus(event.target.value as "all" | EpisodeStatus)}
              >
                <option value="all">Tất cả trạng thái</option>
                {(Object.entries(statuses) as Array<[EpisodeStatus, { label: string }]>).map(
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
    </div>
  )
}

export { EpisodesPage }
