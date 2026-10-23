import {
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  CircleDot,
  Info,
  Layers3,
  Pencil,
  Plus,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import { TemplateAuthoringPage, type AuthoringMode } from "@/components/template-authoring-page"
import {
  getCurrentVersion,
  initialTemplates,
  purposeLabels,
  purposeTones,
  statusPresentation,
  type Purpose,
  type TemplateRecord,
  type TemplateVariableDefinition,
} from "@/components/template-data"
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
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { TemplateThumbnail } from "@/components/ui/template-thumbnail"

type Category = "all" | Purpose
type DetailTab = "overview" | "content" | "variables" | "history"
type DemoState = "ready" | "empty" | "loading" | "error"
type AuthorDemoState = "ready" | "loading" | "error" | "save-error"
type SortOption = "updated-desc" | "updated-asc" | "name-asc" | "name-desc"
type AuthoringState = { mode: AuthoringMode; templateId?: string }

const detailTabs: readonly TabItem<DetailTab>[] = [
  { value: "overview", label: "Tổng quan" },
  { value: "content", label: "Nội dung" },
  { value: "variables", label: "Biến sử dụng" },
  { value: "history", label: "Lịch sử" },
]

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
})

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
})

const numberFormatter = new Intl.NumberFormat("vi-VN")

function formatDate(value: string) {
  return dateFormatter.format(new Date(value))
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return `${formatDate(value)} ${timeFormatter.format(date)}`
}

const templateColumns: readonly DataTableColumn<TemplateRecord>[] = [
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
    searchableValue: (template) => purposeLabels[template.purpose],
    cell: (template) => (
      <Badge variant={purposeTones[template.purpose]}>{purposeLabels[template.purpose]}</Badge>
    ),
  },
  {
    id: "version",
    header: "Phiên bản",
    width: "11%",
    className: "px-2 text-xs font-medium tabular-nums text-muted-foreground",
    headerClassName: "px-2",
    cell: (template) => getCurrentVersion(template).version,
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
    searchableValue: (template) => statusPresentation[template.status].label,
    cell: (template) => (
      <StatusBadge
        label={statusPresentation[template.status].label}
        tone={statusPresentation[template.status].tone}
      />
    ),
  },
]

function getSearchParam(name: string, allowed: readonly string[], fallback: string) {
  const value = new URLSearchParams(window.location.search).get(name)
  return value && allowed.includes(value) ? value : fallback
}

function getInitialCategory(): Category {
  return getSearchParam("category", ["all", ...Object.keys(purposeLabels)], "all") as Category
}

function getInitialTemplateId() {
  const templateId = new URLSearchParams(window.location.search).get("template")
  return initialTemplates.some((template) => template.id === templateId) ? templateId! : initialTemplates[0]!.id
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

function getInitialAuthorDemoState(): AuthorDemoState {
  return getSearchParam(
    "authorState",
    ["ready", "loading", "error", "save-error"],
    "ready",
  ) as AuthorDemoState
}

function getInitialAuthoringState(): AuthoringState | null {
  const mode = new URLSearchParams(window.location.search).get("author")
  if (mode === "create") return { mode: "create" }
  if (mode === "edit") return { mode: "edit", templateId: getInitialTemplateId() }
  return null
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

function setAuthoringUrl(mode: AuthoringMode | null) {
  const url = new URL(window.location.href)
  if (mode) url.searchParams.set("author", mode)
  else {
    url.searchParams.delete("author")
    url.searchParams.delete("authorState")
    url.searchParams.delete("authorStep")
    url.searchParams.delete("authorRail")
  }
  window.history.replaceState(null, "", url)
}

function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRecord[]>(() => initialTemplates)
  const [category, setCategory] = useState<Category>(getInitialCategory)
  const [selectedId, setSelectedId] = useState(getInitialTemplateId)
  const [detailTab, setDetailTab] = useState<DetailTab>(getInitialDetailTab)
  const [demoState, setDemoState] = useState<DemoState>(getInitialDemoState)
  const [authoring, setAuthoring] = useState<AuthoringState | null>(getInitialAuthoringState)
  const [saveNotice, setSaveNotice] = useState("")
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "")
  const [purpose, setPurpose] = useState(() =>
    getSearchParam("purpose", ["all", ...Object.keys(purposeLabels)], "all"),
  )
  const [status, setStatus] = useState(() =>
    getSearchParam("status", ["all", "active", "experimental", "inactive"], "all"),
  )
  const [sorting, setSorting] = useState<DataTableSorting>(getInitialSorting)

  useEffect(
    () => updateTemplateUrl({ category, detailTab, templateId: selectedId, query, purpose, sorting, status }),
    [category, detailTab, purpose, query, selectedId, sorting, status],
  )

  const categoryTabs = useMemo<readonly TabItem<Category>[]>(
    () => [
      { value: "all", label: `Tất cả (${templates.length})` },
      ...(Object.entries(purposeLabels) as Array<[Purpose, string]>).map(([value, label]) => ({
        value,
        label: `${label} (${templates.filter((template) => template.purpose === value).length})`,
      })),
    ],
    [templates],
  )

  const filterTemplate = useCallback(
    (template: TemplateRecord) => {
      const matchesCategory = category === "all" || template.purpose === category
      const matchesPurpose = purpose === "all" || template.purpose === purpose
      const matchesStatus = status === "all" || template.status === status
      return matchesCategory && matchesPurpose && matchesStatus
    },
    [category, purpose, status],
  )

  const matchingTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    return templates.filter((template) => {
      if (!filterTemplate(template)) return false
      if (!normalizedQuery) return true
      return `${template.name} ${template.description} ${purposeLabels[template.purpose]} ${statusPresentation[template.status].label}`
        .toLocaleLowerCase("vi")
        .includes(normalizedQuery)
    })
  }, [filterTemplate, query, templates])

  useEffect(() => {
    if (matchingTemplates.length === 0) return
    if (!matchingTemplates.some((template) => template.id === selectedId)) {
      setSelectedId(matchingTemplates[0]!.id)
    }
  }, [matchingTemplates, selectedId])

  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? templates[0]!
  const editingTemplate =
    authoring?.mode === "edit"
      ? templates.find((template) => template.id === authoring.templateId) ?? selectedTemplate
      : undefined

  function retryDemoState() {
    setDemoState("ready")
    const url = new URL(window.location.href)
    url.searchParams.delete("demo")
    window.history.replaceState(null, "", url)
  }

  function startAuthoring(mode: AuthoringMode, templateId?: string) {
    setSaveNotice("")
    setAuthoring({ mode, templateId })
    setAuthoringUrl(mode)
  }

  function exitAuthoring() {
    setAuthoring(null)
    setAuthoringUrl(null)
  }

  function saveTemplate(template: TemplateRecord, message: string) {
    setTemplates((current) => {
      const exists = current.some((item) => item.id === template.id)
      return exists
        ? current.map((item) => (item.id === template.id ? template : item))
        : [template, ...current]
    })
    setSelectedId(template.id)
    setCategory("all")
    setPurpose("all")
    setStatus("all")
    setDetailTab("overview")
    setSaveNotice(message)
    exitAuthoring()
  }

  if (authoring) {
    return (
      <TemplateAuthoringPage
        key={`${authoring.mode}-${editingTemplate?.id ?? "new"}`}
        mode={authoring.mode}
        template={editingTemplate}
        templates={templates}
        initialDemoState={getInitialAuthorDemoState()}
        onCancel={exitAuthoring}
        onSave={saveTemplate}
      />
    )
  }

  return (
    <div className="grid min-h-screen bg-background xl:grid-cols-[minmax(0,1fr)_var(--spacing-detail-panel)]">
      <div className="min-w-0 px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
        <PageHeader
          title="Templates"
          description="Quản lý các mẫu prompt để tạo nội dung nhanh và nhất quán cho kênh."
          action={
            <Button type="button" variant="accent" size="lg" onClick={() => startAuthoring("create")}>
              <Plus aria-hidden="true" />
              Tạo template mới
            </Button>
          }
        />

        {saveNotice && (
          <div role="status" className="mt-4 flex items-center gap-2 rounded-md border border-success/20 bg-success-soft px-3 py-2 text-xs text-success">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">{saveNotice}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng thông báo" onClick={() => setSaveNotice("")}>
              <X aria-hidden="true" />
            </Button>
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <Tabs
            items={categoryTabs}
            value={category}
            onValueChange={setCategory}
            ariaLabel="Danh mục template"
            panelId="templates-panel"
          />
        </div>

        <section id="templates-panel" role="tabpanel" aria-labelledby={`templates-panel-${category}-tab`} className="mt-4">
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
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Chỉnh sửa ${template.name}`} onClick={() => startAuthoring("edit", template.id)}>
                <Pencil aria-hidden="true" />
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
                  <Select label="Lọc theo mục đích" name="purpose-filter" value={purpose} onChange={(event) => setPurpose(event.target.value)} labelClassName="lg:w-36 xl:w-full 2xl:w-36">
                    <option value="all">Mục đích</option>
                    {purposeOptions().map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                  <Select label="Lọc theo trạng thái" name="status-filter" value={status} onChange={(event) => setStatus(event.target.value)} labelClassName="lg:w-40 xl:w-full 2xl:w-40">
                    <option value="all">Trạng thái</option>
                    {(Object.entries(statusPresentation) as Array<[string, { label: string }]>).map(([value, presentation]) => (
                      <option key={value} value={value}>{presentation.label}</option>
                    ))}
                  </Select>
                  <Select label="Sắp xếp template" name="template-sort" value={optionFromSorting(sorting)} onChange={(event) => setSorting(sortingFromOption(event.target.value as SortOption))} labelClassName="lg:w-36 xl:w-full 2xl:w-36">
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

      <TemplateDetail
        template={selectedTemplate}
        tab={detailTab}
        onTabChange={setDetailTab}
        onEdit={() => startAuthoring("edit", selectedTemplate.id)}
      />
    </div>
  )
}

function TemplateDetail({ template, tab, onTabChange, onEdit }: { template: TemplateRecord; tab: DetailTab; onTabChange: (tab: DetailTab) => void; onEdit: () => void }) {
  const currentVersion = getCurrentVersion(template)
  const status = statusPresentation[template.status]
  return (
    <DetailPanel aria-label={`Chi tiết ${template.name}`}>
      <DetailPanelHeader>
        <div className="flex min-w-0 items-start gap-3">
          <TemplateThumbnail kind={template.thumbnail} className="size-14" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 text-sm font-bold leading-5 text-primary text-pretty">{template.name}</h2>
              <StatusBadge label={status.label} tone={status.tone} />
            </div>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {currentVersion.version} <span className="px-1.5 text-border-strong">•</span> Cập nhật {formatDate(template.updatedAt)}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            Chỉnh sửa
          </Button>
        </div>
      </DetailPanelHeader>

      <div className="overflow-x-auto px-5">
        <Tabs items={detailTabs} value={tab} onValueChange={onTabChange} ariaLabel="Nội dung chi tiết template" panelId="template-detail-panel" className="justify-between gap-0" />
      </div>

      <div id="template-detail-panel" role="tabpanel" aria-labelledby={`template-detail-panel-${tab}-tab`}>
        {tab === "overview" && <TemplateOverview template={template} />}
        {tab === "content" && <TemplateContent template={template} />}
        {tab === "variables" && <TemplateVariables template={template} />}
        {tab === "history" && <TemplateHistory template={template} />}
      </div>
    </DetailPanel>
  )
}

function TemplateOverview({ template }: { template: TemplateRecord }) {
  const currentVersion = getCurrentVersion(template)
  const status = statusPresentation[template.status]
  return (
    <>
      <DetailSection title="Mô tả">
        <p className="text-xs leading-5 text-muted-foreground text-pretty">{template.description}</p>
      </DetailSection>
      <DetailDivider />
      <DetailSection title="Thông tin">
        <dl className="space-y-2.5">
          <DetailInfoRow icon={Layers3} label="Mục đích"><Badge variant={purposeTones[template.purpose]}>{purposeLabels[template.purpose]}</Badge></DetailInfoRow>
          <DetailInfoRow icon={CircleDot} label="Trạng thái"><StatusBadge label={status.label} tone={status.tone} /></DetailInfoRow>
          <DetailInfoRow icon={Info} label="Phiên bản hiện tại"><span className="font-medium tabular-nums text-foreground">{currentVersion.version}</span></DetailInfoRow>
          <DetailInfoRow icon={CalendarClock} label="Cập nhật"><time className="tabular-nums" dateTime={template.updatedAt}>{formatDateTime(template.updatedAt)}</time></DetailInfoRow>
          <DetailInfoRow icon={UserRound} label="Người tạo">{template.createdBy}</DetailInfoRow>
          <DetailInfoRow icon={ChartNoAxesColumnIncreasing} label="Lượt sử dụng"><span className="tabular-nums">{numberFormatter.format(template.usageCount)} lần</span></DetailInfoRow>
        </dl>
      </DetailSection>
      <DetailDivider />
      <DetailSection title="Biến sử dụng"><VariableList variables={currentVersion.variables} /></DetailSection>
    </>
  )
}

function TemplateContent({ template }: { template: TemplateRecord }) {
  const currentVersion = getCurrentVersion(template)
  return (
    <DetailSection title={`Nội dung prompt · ${currentVersion.version}`}>
      <pre className="max-h-[calc(100vh-13rem)] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/45 p-3 font-sans text-xs leading-5 text-muted-foreground">{currentVersion.content}</pre>
    </DetailSection>
  )
}

function TemplateVariables({ template }: { template: TemplateRecord }) {
  const variables = getCurrentVersion(template).variables
  return (
    <DetailSection title={`${variables.length} biến đang dùng`}>
      <VariableList variables={variables} />
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-muted-foreground">
        <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        Biến được validate trước khi render và được lưu cùng snapshot phiên bản.
      </p>
    </DetailSection>
  )
}

function TemplateHistory({ template }: { template: TemplateRecord }) {
  return (
    <DetailSection title="Lịch sử phiên bản">
      <ol className="space-y-4">
        {template.versions.map((version, index) => (
          <HistoryItem key={version.version} active={index === 0} version={version.version} note={version.changeNote} date={formatDateTime(version.createdAt)} dateTime={version.createdAt} />
        ))}
      </ol>
    </DetailSection>
  )
}

function DetailInfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[16px_132px_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
      <Icon aria-hidden="true" className="size-3.5 text-info" />
      <dt>{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function VariableList({ variables }: { variables: TemplateVariableDefinition[] }) {
  if (variables.length === 0) return <p className="text-xs text-muted-foreground">Template này không dùng biến.</p>
  return (
    <div className="overflow-hidden rounded-md border border-border">
      {variables.map((variable) => (
        <div key={variable.id} className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0">
          <code translate="no" className="w-fit rounded bg-accent-soft px-1.5 py-0.5 font-mono text-accent-strong">{`{{${variable.name}}}`}</code>
          <span className="break-words text-muted-foreground">{variable.label}</span>
        </div>
      ))}
    </div>
  )
}

function HistoryItem({ active = false, version, note, date, dateTime }: { active?: boolean; version: string; note: string; date: string; dateTime: string }) {
  return (
    <li className="grid grid-cols-[12px_38px_minmax(0,1fr)] items-start gap-2 text-[11px]">
      <span aria-hidden="true" className={`mt-1 size-2 rounded-full ${active ? "bg-success" : "bg-border-strong"}`} />
      <strong className="text-primary">{version}</strong>
      <span className="min-w-0">
        <span className="block text-muted-foreground text-pretty">{note}</span>
        <time className="mt-1 block tabular-nums text-muted-foreground" dateTime={dateTime}>{date} · Bạn</time>
      </span>
    </li>
  )
}

function purposeOptions() {
  return Object.entries(purposeLabels) as Array<[Purpose, string]>
}

export { TemplatesPage }
