import {
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  CircleDot,
  Info,
  Layers3,
  MoreVertical,
  Plus,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DataTable,
  type DataTableColumn,
  type DataTableSorting,
} from "@/components/ui/data-table"
import {
  DetailDivider,
  DetailPanel,
  DetailPanelHeader,
  DetailSection,
} from "@/components/ui/detail-panel"
import { PageHeader } from "@/components/ui/page-header"
import { SearchField } from "@/components/ui/search-field"
import { Select } from "@/components/ui/select"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { TemplateThumbnail, type ThumbnailKind } from "@/components/ui/template-thumbnail"

type Category = "all" | "script" | "thumbnail" | "hook" | "description" | "idea" | "other"
type Purpose = Exclude<Category, "all" | "other">
type DetailTab = "overview" | "content" | "variables" | "history"
type DemoState = "ready" | "empty" | "loading" | "error"
type SortOption = "updated-desc" | "updated-asc" | "name-asc" | "name-desc"

type TemplateItem = {
  id: string
  name: string
  description: string
  purpose: Purpose
  purposeLabel: string
  version: string
  updatedAt: string
  status: string
  statusTone: StatusTone
  thumbnail: ThumbnailKind
  usageCount: number
}

type TemplateVariable = {
  name: string
  description: string
}

const templates: TemplateItem[] = [
  {
    id: "youtube-long-form",
    name: "YouTube Script (Long-form)",
    description: "Tạo kịch bản chi tiết cho video dạng dài với cấu trúc rõ ràng, lôi cuốn.",
    purpose: "script",
    purposeLabel: "Script",
    version: "v1.2",
    updatedAt: "2026-10-22",
    status: "Đang dùng",
    statusTone: "success",
    thumbnail: "desk",
    usageCount: 24,
  },
  {
    id: "youtube-hook",
    name: "YouTube Hook Generator",
    description: "Tạo nhiều phiên bản hook hấp dẫn dành cho video.",
    purpose: "hook",
    purposeLabel: "Hook",
    version: "v1.0",
    updatedAt: "2026-10-20",
    status: "Đang dùng",
    statusTone: "success",
    thumbnail: "mountain",
    usageCount: 18,
  },
  {
    id: "thumbnail-concept",
    name: "Thumbnail Concept",
    description: "Tạo ý tưởng thumbnail sáng tạo, phù hợp với nội dung video.",
    purpose: "thumbnail",
    purposeLabel: "Thumbnail",
    version: "v1.1",
    updatedAt: "2026-10-18",
    status: "Thử nghiệm",
    statusTone: "warning",
    thumbnail: "studio",
    usageCount: 9,
  },
  {
    id: "video-description",
    name: "Video Description",
    description: "Tạo mô tả YouTube chuẩn SEO, bao gồm từ khóa và timestamp.",
    purpose: "description",
    purposeLabel: "Mô tả",
    version: "v1.0",
    updatedAt: "2026-10-15",
    status: "Không hoạt động",
    statusTone: "neutral",
    thumbnail: "notes",
    usageCount: 6,
  },
  {
    id: "video-idea",
    name: "Video Idea Generator",
    description: "Đề xuất ý tưởng video dựa trên chủ đề và xu hướng hiện tại.",
    purpose: "idea",
    purposeLabel: "Ý tưởng",
    version: "v1.0",
    updatedAt: "2026-10-12",
    status: "Đang dùng",
    statusTone: "success",
    thumbnail: "idea",
    usageCount: 31,
  },
  {
    id: "short-script",
    name: "Short Script (TikTok/Shorts)",
    description: "Tạo kịch bản ngắn, súc tích cho video ngắn.",
    purpose: "script",
    purposeLabel: "Script",
    version: "v1.0",
    updatedAt: "2026-10-10",
    status: "Thử nghiệm",
    statusTone: "warning",
    thumbnail: "laptop",
    usageCount: 12,
  },
]

const categoryTabs: readonly TabItem<Category>[] = [
  { value: "all", label: `Tất cả (${templates.length})` },
  { value: "script", label: `Script (${templates.filter((item) => item.purpose === "script").length})` },
  { value: "thumbnail", label: `Thumbnail (${templates.filter((item) => item.purpose === "thumbnail").length})` },
  { value: "hook", label: `Hook (${templates.filter((item) => item.purpose === "hook").length})` },
  { value: "description", label: `Mô tả (${templates.filter((item) => item.purpose === "description").length})` },
  { value: "idea", label: `Ý tưởng (${templates.filter((item) => item.purpose === "idea").length})` },
  { value: "other", label: "Khác (0)" },
]

const detailTabs: readonly TabItem<DetailTab>[] = [
  { value: "overview", label: "Tổng quan" },
  { value: "content", label: "Nội dung" },
  { value: "variables", label: "Biến sử dụng" },
  { value: "history", label: "Lịch sử" },
]

const variablesByPurpose: Record<Purpose, TemplateVariable[]> = {
  script: [
    { name: "{{topic}}", description: "Chủ đề chính của video" },
    { name: "{{tone}}", description: "Giọng văn mong muốn" },
    { name: "{{duration}}", description: "Độ dài mong muốn (phút)" },
    { name: "{{key_points}}", description: "Các ý chính cần có" },
  ],
  thumbnail: [
    { name: "{{topic}}", description: "Chủ đề chính của video" },
    { name: "{{subject}}", description: "Chủ thể cần nhấn mạnh" },
    { name: "{{mood}}", description: "Cảm xúc hình ảnh" },
    { name: "{{colors}}", description: "Bảng màu mong muốn" },
  ],
  hook: [
    { name: "{{topic}}", description: "Chủ đề chính của video" },
    { name: "{{audience}}", description: "Khán giả mục tiêu" },
    { name: "{{tone}}", description: "Giọng điệu của hook" },
    { name: "{{count}}", description: "Số phương án cần tạo" },
  ],
  description: [
    { name: "{{title}}", description: "Tiêu đề video" },
    { name: "{{keywords}}", description: "Từ khóa SEO chính" },
    { name: "{{chapters}}", description: "Danh sách timestamp" },
    { name: "{{links}}", description: "Liên kết cần đính kèm" },
  ],
  idea: [
    { name: "{{niche}}", description: "Chủ đề hoặc ngách nội dung" },
    { name: "{{audience}}", description: "Khán giả mục tiêu" },
    { name: "{{goal}}", description: "Mục tiêu của video" },
    { name: "{{constraints}}", description: "Giới hạn hoặc yêu cầu riêng" },
  ],
}

const purposeTone = {
  script: "attention",
  thumbnail: "lavender",
  hook: "info",
  description: "success",
  idea: "danger",
} as const

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
})

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
})

const numberFormatter = new Intl.NumberFormat("vi-VN")

function toDate(value: string, time = "12:00:00") {
  return new Date(`${value}T${time}+07:00`)
}

function formatDate(value: string) {
  return dateFormatter.format(toDate(value))
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(toDate(value, "14:30:00"))
}

const templateColumns: readonly DataTableColumn<TemplateItem>[] = [
  {
    id: "name",
    header: "Template",
    width: "44%",
    sortValue: (template) => template.name,
    sortable: false,
    searchableValue: (template) => `${template.name} ${template.description}`,
    cell: (template) => (
      <div className="flex min-w-0 items-center gap-3">
        <TemplateThumbnail kind={template.thumbnail} />
        <span className="min-w-0">
          <span className="block truncate font-bold text-primary">{template.name}</span>
          <span className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
            {template.description}
          </span>
        </span>
      </div>
    ),
  },
  {
    id: "purpose",
    header: "Mục đích",
    width: "15%",
    searchableValue: (template) => template.purposeLabel,
    cell: (template) => (
      <Badge variant={purposeTone[template.purpose]}>{template.purposeLabel}</Badge>
    ),
  },
  {
    id: "version",
    header: "Phiên bản",
    width: "11%",
    className: "px-2 text-xs font-medium tabular-nums text-muted-foreground",
    headerClassName: "px-2",
    cell: (template) => template.version,
  },
  {
    id: "updatedAt",
    header: "Cập nhật",
    width: "15%",
    sortValue: (template) => template.updatedAt,
    sortable: false,
    className: "text-xs tabular-nums text-muted-foreground",
    cell: (template) => formatDate(template.updatedAt),
  },
  {
    id: "status",
    header: "Trạng thái",
    width: "15%",
    searchableValue: (template) => template.status,
    cell: (template) => <StatusBadge label={template.status} tone={template.statusTone} />,
  },
]

function getSearchParam(name: string, allowed: readonly string[], fallback: string) {
  const value = new URLSearchParams(window.location.search).get(name)
  return value && allowed.includes(value) ? value : fallback
}

function getInitialCategory(): Category {
  return getSearchParam(
    "category",
    categoryTabs.map((item) => item.value),
    "all",
  ) as Category
}

function getInitialTemplateId() {
  const templateId = new URLSearchParams(window.location.search).get("template")
  return templates.some((template) => template.id === templateId) ? templateId! : templates[0]!.id
}

function getInitialDetailTab(): DetailTab {
  return getSearchParam(
    "detail",
    detailTabs.map((item) => item.value),
    "overview",
  ) as DetailTab
}

function getInitialDemoState(): DemoState {
  return getSearchParam("demo", ["ready", "empty", "loading", "error"], "ready") as DemoState
}

function getInitialSorting(): DataTableSorting {
  const value = getSearchParam(
    "sort",
    ["updated-desc", "updated-asc", "name-asc", "name-desc"],
    "updated-desc",
  ) as SortOption
  return sortingFromOption(value)
}

function sortingFromOption(value: SortOption): DataTableSorting {
  if (value === "name-asc") return { columnId: "name", direction: "asc" }
  if (value === "name-desc") return { columnId: "name", direction: "desc" }
  return { columnId: "updatedAt", direction: value === "updated-asc" ? "asc" : "desc" }
}

function optionFromSorting(sorting: DataTableSorting): SortOption {
  if (sorting.columnId === "name") return sorting.direction === "asc" ? "name-asc" : "name-desc"
  return sorting.direction === "asc" ? "updated-asc" : "updated-desc"
}

function updateTemplateUrl(state: {
  category: Category
  detailTab: DetailTab
  templateId: string
  query: string
  purpose: string
  status: string
  sorting: DataTableSorting
}) {
  const url = new URL(window.location.href)
  url.searchParams.set("category", state.category)
  url.searchParams.set("template", state.templateId)
  state.detailTab !== "overview"
    ? url.searchParams.set("detail", state.detailTab)
    : url.searchParams.delete("detail")
  state.query ? url.searchParams.set("q", state.query) : url.searchParams.delete("q")
  state.purpose !== "all" ? url.searchParams.set("purpose", state.purpose) : url.searchParams.delete("purpose")
  state.status !== "all" ? url.searchParams.set("status", state.status) : url.searchParams.delete("status")
  const sortParam = optionFromSorting(state.sorting)
  sortParam !== "updated-desc" ? url.searchParams.set("sort", sortParam) : url.searchParams.delete("sort")
  window.history.replaceState(null, "", url)
}

function TemplatesPage() {
  const [category, setCategory] = useState<Category>(getInitialCategory)
  const [selectedId, setSelectedId] = useState(getInitialTemplateId)
  const [detailTab, setDetailTab] = useState<DetailTab>(getInitialDetailTab)
  const [demoState, setDemoState] = useState<DemoState>(getInitialDemoState)
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "")
  const [purpose, setPurpose] = useState(() =>
    getSearchParam("purpose", ["all", "script", "hook", "thumbnail", "description", "idea"], "all"),
  )
  const [status, setStatus] = useState(() =>
    getSearchParam("status", ["all", "success", "warning", "neutral"], "all"),
  )
  const [sorting, setSorting] = useState<DataTableSorting>(getInitialSorting)

  useEffect(
    () => updateTemplateUrl({ category, detailTab, templateId: selectedId, query, purpose, sorting, status }),
    [category, detailTab, purpose, query, selectedId, sorting, status],
  )

  const filterTemplate = useCallback(
    (template: TemplateItem) => {
      const matchesCategory = category === "all" || template.purpose === category
      const matchesPurpose = purpose === "all" || template.purpose === purpose
      const matchesStatus = status === "all" || template.statusTone === status
      return matchesCategory && matchesPurpose && matchesStatus
    },
    [category, purpose, status],
  )

  const matchingTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    return templates.filter((template) => {
      if (!filterTemplate(template)) return false
      if (!normalizedQuery) return true
      return `${template.name} ${template.description} ${template.purposeLabel} ${template.status}`
        .toLocaleLowerCase("vi")
        .includes(normalizedQuery)
    })
  }, [filterTemplate, query])

  useEffect(() => {
    if (matchingTemplates.length === 0) return
    if (!matchingTemplates.some((template) => template.id === selectedId)) {
      setSelectedId(matchingTemplates[0]!.id)
    }
  }, [matchingTemplates, selectedId])

  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? templates[0]!

  function retryDemoState() {
    setDemoState("ready")
    const url = new URL(window.location.href)
    url.searchParams.delete("demo")
    window.history.replaceState(null, "", url)
  }

  return (
    <div className="grid min-h-screen bg-background xl:grid-cols-[minmax(0,1fr)_var(--spacing-detail-panel)]">
      <div className="min-w-0 px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
        <PageHeader
          title="Templates"
          description="Quản lý các mẫu prompt để tạo nội dung nhanh và nhất quán cho kênh."
          action={
            <Button
              type="button"
              variant="accent"
              size="lg"
              disabled
              title="Sẽ được triển khai trong M2"
              className="disabled:opacity-100"
            >
              <Plus aria-hidden="true" />
              Tạo template mới
            </Button>
          }
        />

        <div className="mt-5 overflow-x-auto">
          <Tabs
            items={categoryTabs}
            value={category}
            onValueChange={setCategory}
            ariaLabel="Danh mục template"
            panelId="templates-panel"
          />
        </div>

        <section
          id="templates-panel"
          role="tabpanel"
          aria-labelledby={`templates-panel-${category}-tab`}
          className="mt-4"
        >
          <DataTable
            caption="Danh sách template nội dung"
            columns={templateColumns}
            data={demoState === "empty" ? [] : templates}
            getRowId={(template) => template.id}
            getRowLabel={(template) => template.name}
            activeRowId={selectedTemplate.id}
            globalFilter={query}
            filterFn={filterTemplate}
            sorting={sorting}
            onRowClick={(template) => setSelectedId(template.id)}
            isLoading={demoState === "loading"}
            error={demoState === "error"}
            onRetry={retryDemoState}
            rowActions={(template) => (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled
                aria-label={`Mở thao tác cho ${template.name}`}
                title="Thao tác template sẽ được triển khai trong M2"
                className="disabled:opacity-100"
              >
                <MoreVertical aria-hidden="true" />
              </Button>
            )}
            toolbar={
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center xl:flex-col xl:items-stretch 2xl:flex-row 2xl:items-center">
                <SearchField
                  label="Tìm template"
                  name="template-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm template…"
                  className="min-w-52 flex-1"
                />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex lg:shrink-0 xl:grid xl:grid-cols-3 2xl:flex">
                  <Select
                    label="Lọc theo mục đích"
                    name="purpose-filter"
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                    labelClassName="lg:w-36 xl:w-full 2xl:w-36"
                  >
                    <option value="all">Mục đích</option>
                    <option value="script">Script</option>
                    <option value="hook">Hook</option>
                    <option value="thumbnail">Thumbnail</option>
                    <option value="description">Mô tả</option>
                    <option value="idea">Ý tưởng</option>
                  </Select>
                  <Select
                    label="Lọc theo trạng thái"
                    name="status-filter"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    labelClassName="lg:w-40 xl:w-full 2xl:w-40"
                  >
                    <option value="all">Trạng thái</option>
                    <option value="success">Đang dùng</option>
                    <option value="warning">Thử nghiệm</option>
                    <option value="neutral">Không hoạt động</option>
                  </Select>
                  <Select
                    label="Sắp xếp template"
                    name="template-sort"
                    value={optionFromSorting(sorting)}
                    onChange={(event) => setSorting(sortingFromOption(event.target.value as SortOption))}
                    labelClassName="lg:w-36 xl:w-full 2xl:w-36"
                  >
                    <option value="updated-desc">Mới cập nhật</option>
                    <option value="updated-asc">Cũ nhất</option>
                    <option value="name-asc">Tên A–Z</option>
                    <option value="name-desc">Tên Z–A</option>
                  </Select>
                </div>
              </div>
            }
          />
        </section>
      </div>

      <TemplateDetail template={selectedTemplate} tab={detailTab} onTabChange={setDetailTab} />
    </div>
  )
}

function TemplateDetail({
  template,
  tab,
  onTabChange,
}: {
  template: TemplateItem
  tab: DetailTab
  onTabChange: (tab: DetailTab) => void
}) {
  return (
    <DetailPanel aria-label={`Chi tiết ${template.name}`}>
      <DetailPanelHeader>
        <div className="flex min-w-0 items-start gap-3">
          <TemplateThumbnail kind={template.thumbnail} className="size-14" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 text-sm font-bold leading-5 text-primary text-pretty">
                {template.name}
              </h2>
              <StatusBadge label={template.status} tone={template.statusTone} />
            </div>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {template.version} <span className="px-1.5 text-border-strong">•</span> Cập nhật {formatDate(template.updatedAt)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled
            aria-label={`Mở thao tác cho ${template.name}`}
            title="Thao tác template sẽ được triển khai trong M2"
            className="disabled:opacity-100"
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </div>
      </DetailPanelHeader>

      <div className="overflow-x-auto px-5">
        <Tabs
          items={detailTabs}
          value={tab}
          onValueChange={onTabChange}
          ariaLabel="Nội dung chi tiết template"
          panelId="template-detail-panel"
          className="justify-between gap-0"
        />
      </div>

      <div
        id="template-detail-panel"
        role="tabpanel"
        aria-labelledby={`template-detail-panel-${tab}-tab`}
      >
        {tab === "overview" && <TemplateOverview template={template} />}
        {tab === "content" && <TemplateContent template={template} />}
        {tab === "variables" && <TemplateVariables template={template} />}
        {tab === "history" && <TemplateHistory template={template} />}
      </div>
    </DetailPanel>
  )
}

function TemplateOverview({ template }: { template: TemplateItem }) {
  return (
    <>
      <DetailSection title="Mô tả">
        <p className="text-xs leading-5 text-muted-foreground text-pretty">
          {template.description} Nội dung được giữ ngắn gọn, dễ rà soát và phù hợp với phong cách của{" "}
          <span translate="no">Ngộ Dậy Studio</span>.
        </p>
      </DetailSection>

      <DetailDivider />
      <DetailSection title="Thông tin">
        <dl className="space-y-2.5">
          <DetailInfoRow icon={Layers3} label="Mục đích">
            <Badge variant={purposeTone[template.purpose]}>{template.purposeLabel}</Badge>
          </DetailInfoRow>
          <DetailInfoRow icon={CircleDot} label="Trạng thái">
            <StatusBadge label={template.status} tone={template.statusTone} />
          </DetailInfoRow>
          <DetailInfoRow icon={Info} label="Phiên bản hiện tại">
            <span className="font-medium tabular-nums text-foreground">{template.version}</span>
          </DetailInfoRow>
          <DetailInfoRow icon={CalendarClock} label="Cập nhật">
            <time className="tabular-nums" dateTime={`${template.updatedAt}T14:30:00+07:00`}>
              {formatDateTime(template.updatedAt)}
            </time>
          </DetailInfoRow>
          <DetailInfoRow icon={UserRound} label="Người tạo">
            Bạn
          </DetailInfoRow>
          <DetailInfoRow icon={ChartNoAxesColumnIncreasing} label="Lượt sử dụng">
            <span className="tabular-nums">{numberFormatter.format(template.usageCount)} lần</span>
          </DetailInfoRow>
        </dl>
      </DetailSection>

      <DetailDivider />
      <DetailSection title="Biến sử dụng">
        <VariableList variables={variablesByPurpose[template.purpose]} />
      </DetailSection>
    </>
  )
}

function TemplateContent({ template }: { template: TemplateItem }) {
  const variables = variablesByPurpose[template.purpose]
  return (
    <DetailSection title="Nội dung prompt">
      <pre className="max-h-[calc(100vh-13rem)] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/45 p-3 font-sans text-xs leading-5 text-muted-foreground">
        {`Bạn là một biên tập viên nội dung chuyên nghiệp.

Hãy tạo ${template.purposeLabel.toLocaleLowerCase("vi")} cho chủ đề ${variables[0]?.name ?? "{{topic}}"}.

Yêu cầu:
- Nội dung rõ ràng, tự nhiên và dễ chỉnh sửa.
- Giữ đúng mục tiêu của template “${template.name}”.
- Sử dụng đầy đủ các biến được cung cấp.`}
      </pre>
    </DetailSection>
  )
}

function TemplateVariables({ template }: { template: TemplateItem }) {
  return (
    <DetailSection title={`${variablesByPurpose[template.purpose].length} biến đang dùng`}>
      <VariableList variables={variablesByPurpose[template.purpose]} />
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-muted-foreground">
        <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        Đây là dữ liệu mock để duyệt cấu trúc browse; chỉnh sửa biến thuộc phạm vi M2.
      </p>
    </DetailSection>
  )
}

function TemplateHistory({ template }: { template: TemplateItem }) {
  return (
    <DetailSection title="Lịch sử phiên bản">
      <ol className="space-y-4">
        <HistoryItem
          active
          version={template.version}
          note="Cập nhật cấu trúc và tinh chỉnh nội dung prompt."
          date={formatDateTime(template.updatedAt)}
          dateTime={`${template.updatedAt}T14:30:00+07:00`}
        />
        <HistoryItem
          version="v1.0"
          note="Tạo phiên bản đầu tiên."
          date={dateFormatter.format(toDate("2026-10-05"))}
          dateTime="2026-10-05T09:20:00+07:00"
        />
      </ol>
    </DetailSection>
  )
}

function DetailInfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[16px_132px_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
      <Icon aria-hidden="true" className="size-3.5 text-info" />
      <dt>{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function VariableList({ variables }: { variables: TemplateVariable[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      {variables.map((variable) => (
        <div
          key={variable.name}
          className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0"
        >
          <code translate="no" className="w-fit rounded bg-accent-soft px-1.5 py-0.5 font-mono text-accent-strong">
            {variable.name}
          </code>
          <span className="break-words text-muted-foreground">{variable.description}</span>
        </div>
      ))}
    </div>
  )
}

function HistoryItem({
  active = false,
  version,
  note,
  date,
  dateTime,
}: {
  active?: boolean
  version: string
  note: string
  date: string
  dateTime: string
}) {
  return (
    <li className="grid grid-cols-[12px_38px_minmax(0,1fr)] items-start gap-2 text-[11px]">
      <span aria-hidden="true" className={`mt-1 size-2 rounded-full ${active ? "bg-success" : "bg-border-strong"}`} />
      <strong className="text-primary">{version}</strong>
      <span className="min-w-0">
        <span className="block text-muted-foreground text-pretty">{note}</span>
        <time className="mt-1 block tabular-nums text-muted-foreground" dateTime={dateTime}>
          {date} · Bạn
        </time>
      </span>
    </li>
  )
}

export { TemplatesPage }
