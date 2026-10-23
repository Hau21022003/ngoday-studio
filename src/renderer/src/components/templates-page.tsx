import {
  ArrowRight,
  Copy,
  Info,
  MoreVertical,
  PencilLine,
  Plus,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDivider,
  DetailPanel,
  DetailPanelHeader,
  DetailSection,
} from "@/components/ui/detail-panel"
import { EmptyState } from "@/components/ui/state-feedback"
import { PageHeader } from "@/components/ui/page-header"
import { SearchField } from "@/components/ui/search-field"
import { Select } from "@/components/ui/select"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { TemplateThumbnail, type ThumbnailKind } from "@/components/ui/template-thumbnail"

type Category = "all" | "script" | "thumbnail" | "hook" | "description" | "idea" | "other"
type Purpose = Exclude<Category, "all" | "other">

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
}

const categoryTabs: readonly TabItem<Category>[] = [
  { value: "all", label: "Tất cả" },
  { value: "script", label: "Script" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "hook", label: "Hook" },
  { value: "description", label: "Mô tả" },
  { value: "idea", label: "Ý tưởng" },
  { value: "other", label: "Khác" },
]

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
  },
]

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

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00+07:00`))
}

function getSearchParam(name: string, allowed: readonly string[], fallback: string) {
  const value = new URLSearchParams(window.location.search).get(name)
  return value && allowed.includes(value) ? value : fallback
}

function updateTemplateUrl(state: {
  category: Category
  templateId: string
  query: string
  purpose: string
  status: string
  sort: string
}) {
  const url = new URL(window.location.href)
  url.searchParams.set("category", state.category)
  url.searchParams.set("template", state.templateId)
  state.query ? url.searchParams.set("q", state.query) : url.searchParams.delete("q")
  state.purpose !== "all" ? url.searchParams.set("purpose", state.purpose) : url.searchParams.delete("purpose")
  state.status !== "all" ? url.searchParams.set("status", state.status) : url.searchParams.delete("status")
  state.sort !== "updated-desc" ? url.searchParams.set("sort", state.sort) : url.searchParams.delete("sort")
  window.history.replaceState(null, "", url)
}

function getInitialCategory(): Category {
  const category = new URLSearchParams(window.location.search).get("category")
  return categoryTabs.some((item) => item.value === category) ? (category as Category) : "all"
}

function getInitialTemplateId() {
  const templateId = new URLSearchParams(window.location.search).get("template")
  return templates.some((template) => template.id === templateId) ? templateId! : templates[0]!.id
}

function TemplatesPage() {
  const [category, setCategory] = useState<Category>(getInitialCategory)
  const [selectedId, setSelectedId] = useState(getInitialTemplateId)
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "")
  const [purpose, setPurpose] = useState(() =>
    getSearchParam("purpose", ["all", "script", "hook", "thumbnail", "description", "idea"], "all"),
  )
  const [status, setStatus] = useState(() =>
    getSearchParam("status", ["all", "success", "warning", "neutral"], "all"),
  )
  const [sort, setSort] = useState(() =>
    getSearchParam("sort", ["updated-desc", "updated-asc", "name-asc"], "updated-desc"),
  )

  useEffect(
    () => updateTemplateUrl({ category, templateId: selectedId, query, purpose, status, sort }),
    [category, purpose, query, selectedId, sort, status],
  )

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    const result = templates.filter((template) => {
      const matchesCategory = category === "all" || template.purpose === category
      const matchesPurpose = purpose === "all" || template.purpose === purpose
      const matchesStatus = status === "all" || template.statusTone === status
      const matchesQuery =
        !normalizedQuery ||
        `${template.name} ${template.description}`.toLocaleLowerCase("vi").includes(normalizedQuery)
      return matchesCategory && matchesPurpose && matchesStatus && matchesQuery
    })

    return [...result].sort((left, right) => {
      if (sort === "name-asc") return left.name.localeCompare(right.name, "vi")
      if (sort === "updated-asc") return left.updatedAt.localeCompare(right.updatedAt)
      return right.updatedAt.localeCompare(left.updatedAt)
    })
  }, [category, purpose, query, sort, status])

  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? templates[0]!

  return (
    <div className="grid min-h-screen bg-background xl:grid-cols-[minmax(0,1fr)_var(--spacing-detail-panel)]">
      <div className="min-w-0 px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
        <PageHeader
          title="Templates"
          description="Quản lý các mẫu prompt để tạo nội dung nhanh và nhất quán cho kênh."
          action={
            <Button type="button" variant="accent" size="lg">
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

        <div className="mt-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <SearchField
            label="Tìm template"
            name="template-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm template…"
            className="min-w-52 flex-1"
          />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex lg:shrink-0">
            <Select
              label="Lọc theo mục đích"
              name="purpose-filter"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              className="lg:w-32"
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
              className="lg:w-32"
            >
              <option value="all">Trạng thái</option>
              <option value="success">Đang dùng</option>
              <option value="warning">Thử nghiệm</option>
              <option value="neutral">Không hoạt động</option>
            </Select>
            <Select
              label="Sắp xếp template"
              name="template-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="lg:w-32"
            >
              <option value="updated-desc">Sắp xếp</option>
              <option value="updated-asc">Cũ nhất</option>
              <option value="name-asc">Tên A–Z</option>
            </Select>
          </div>
        </div>

        <section
          id="templates-panel"
          role="tabpanel"
          aria-labelledby={`templates-panel-${category}-tab`}
          aria-label={`Template — ${categoryTabs.find((item) => item.value === category)?.label ?? "Tất cả"}`}
          className="mt-4 overflow-hidden rounded-lg border border-border bg-surface shadow-panel"
        >
          <p className="sr-only" aria-live="polite">
            Hiển thị {numberFormatter.format(filteredTemplates.length)} template. Đang xem {selectedTemplate.name}.
          </p>
          {filteredTemplates.length === 0 ? (
            <EmptyState />
          ) : (
            <TableContainer>
              <Table className="min-w-[720px] table-fixed">
                <caption className="sr-only">Danh sách template nội dung</caption>
                <colgroup>
                  <col className="w-[41%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                  <col className="w-[16%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <TableHeader>
                  <tr>
                    <TableHead>Template</TableHead>
                    <TableHead>Mục đích</TableHead>
                    <TableHead className="px-2">Phiên bản</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead><span className="sr-only">Thao tác</span></TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => {
                    const selected = template.id === selectedTemplate.id
                    return (
                      <TableRow
                        key={template.id}
                        selected={selected}
                        className={selected ? "shadow-[inset_2px_0_0_var(--accent)]" : undefined}
                      >
                        <TableCell>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setSelectedId(template.id)}
                            className="flex w-full min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                          >
                            <TemplateThumbnail kind={template.thumbnail} />
                            <span className="min-w-0">
                              <span className="block truncate font-bold text-primary">{template.name}</span>
                              <span className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
                                {template.description}
                              </span>
                            </span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={purposeTone[template.purpose]}>{template.purposeLabel}</Badge>
                        </TableCell>
                        <TableCell className="px-2 text-xs font-medium tabular-nums text-muted-foreground">
                          {template.version}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {formatDate(template.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge label={template.status} tone={template.statusTone} />
                        </TableCell>
                        <TableCell className="px-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Mở thao tác cho ${template.name}`}
                          >
                            <MoreVertical aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>
      </div>

      <TemplateDetail template={selectedTemplate} />
    </div>
  )
}

function TemplateDetail({ template }: { template: TemplateItem }) {
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
            aria-label={`Mở thao tác cho ${template.name}`}
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </div>
      </DetailPanelHeader>

      <DetailDivider />
      <DetailSection
        title="Mô tả"
        action={
          <Button type="button" variant="outline" size="sm">
            <PencilLine aria-hidden="true" />
            Chỉnh sửa
          </Button>
        }
      >
        <p className="text-xs leading-5 text-muted-foreground text-pretty">
          Tạo kịch bản chi tiết cho video YouTube dạng dài (8–20 phút) với cấu trúc rõ ràng, mở đầu thu hút,
          nội dung mạch lạc và kết thúc mạnh mẽ. Phù hợp với phong cách của{" "}
          <span translate="no">Ngộ Dậy Studio</span>.
        </p>
      </DetailSection>

      <DetailDivider />
      <DetailSection
        title="Biến sử dụng"
        action={
          <Button type="button" variant="outline" size="sm">
            <Copy aria-hidden="true" />
            Sao chép
          </Button>
        }
      >
        <div className="overflow-hidden rounded-md border border-border">
          {[
            ["{{topic}}", "Chủ đề chính của video"],
            ["{{episode_title}}", "Tiêu đề tạm thời (nếu có)"],
            ["{{notes}}", "Ghi chú bổ sung, yêu cầu riêng"],
          ].map(([variable, description]) => (
            <div
              key={variable}
              className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0"
            >
              <code translate="no" className="w-fit rounded bg-accent-soft px-1.5 py-0.5 font-mono text-accent-strong">
                {variable}
              </code>
              <span className="break-words text-muted-foreground">{description}</span>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailDivider />
      <DetailSection
        title="Xem trước prompt"
        action={
          <Button type="button" variant="outline" size="sm">
            <Copy aria-hidden="true" />
            Sao chép
          </Button>
        }
      >
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted/55 p-3 font-sans text-xs leading-5 text-muted-foreground">
          {`Bạn là một biên tập viên YouTube chuyên nghiệp. Hãy tạo kịch bản chi tiết cho video với chủ đề: {{topic}}.

Tiêu đề tạm thời: {{episode_title}}

Yêu cầu: {{notes}}

Kịch bản cần có: mở đầu thu hút, các phần nội dung chính, ví dụ minh họa, và phần kết thúc mạnh mẽ, kêu gọi hành động.`}
        </pre>
      </DetailSection>

      <DetailDivider />
      <DetailSection
        title="Lịch sử phiên bản"
        action={
          <a
            href="#templates"
            className="inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            Xem tất cả
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </a>
        }
      >
        <ol className="space-y-3">
          <li className="grid grid-cols-[12px_38px_minmax(0,1fr)_auto] items-center gap-2 text-[11px]">
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            <strong className="text-primary">v1.2</strong>
            <span className="truncate text-muted-foreground">Cập nhật cấu trúc, bổ sung phần CTA.</span>
            <time className="tabular-nums text-muted-foreground" dateTime="2026-10-22T14:30:00+07:00">
              {dateTimeFormatter.format(new Date("2026-10-22T14:30:00+07:00"))}
            </time>
          </li>
          <li className="grid grid-cols-[12px_38px_minmax(0,1fr)_auto] items-center gap-2 text-[11px]">
            <span aria-hidden="true" className="size-2 rounded-full bg-border-strong" />
            <strong className="text-primary">v1.1</strong>
            <span className="truncate text-muted-foreground">Tinh chỉnh giọng văn, thêm ví dụ minh họa.</span>
            <time className="tabular-nums text-muted-foreground" dateTime="2026-10-15T10:20:00+07:00">
              {dateTimeFormatter.format(new Date("2026-10-15T10:20:00+07:00"))}
            </time>
          </li>
        </ol>
        <p className="mt-4 flex items-start gap-2 text-[11px] leading-4 text-muted-foreground">
          <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          Dữ liệu đang dùng để duyệt UI; chưa kết nối persistence.
        </p>
      </DetailSection>
    </DetailPanel>
  )
}

export { TemplatesPage }
