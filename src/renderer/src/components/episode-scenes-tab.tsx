import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CirclePlus,
  Clapperboard,
  Copy,
  FileJson,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Info,
  ListFilter,
  LoaderCircle,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
  Video,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react"

import type {
  AssetSlot,
  EpisodeAggregate,
  ImportMode,
  RenderedPrompt,
  Scene,
  SceneDetail,
  ScenesImportPreview,
  SceneStatus,
  TemplateAggregate,
  TemplateSummary,
  TemplateVariableDefinition,
} from "../../../shared/domain"
import { scenesJsonV1Sample } from "../../../shared/scenes-json-v1-sample"
import {
  dropSceneId,
  moveSceneId,
  orderChanged,
  reservedSceneVariableNames,
  sceneDraftPatch,
  sceneStructureSignature,
  sceneToDraft,
  slotsByScene,
  validateSceneDraft,
  type SceneDraft,
} from "@/components/scene-workflow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { Select } from "@/components/ui/select"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-feedback"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, StudioClientError, unwrapResult } from "@/data/studio-client"
import { cn } from "@/lib/utils"

type SceneSort = "manual" | "title" | "updated"
type SceneTypeFilter = "all" | Scene["sceneType"]

const sceneTypes = {
  B_ROLL: { label: "B_ROLL", variant: "neutral" },
  ENVIRONMENT: { label: "ENVIRONMENT", variant: "success" },
  MAIN_CHARACTER: { label: "MAIN_CHARACTER", variant: "danger" },
  MOTION_GRAPHIC: { label: "MOTION_GRAPHIC", variant: "warning" },
  SCIENTIFIC_VISUALIZATION: { label: "SCIENTIFIC_VISUALIZATION", variant: "lavender" },
} as const

const statuses = {
  approved: { label: "Đã duyệt", variant: "success", icon: BadgeCheck },
  draft: { label: "Bản nháp", variant: "neutral", icon: FileText },
  in_review: { label: "Đang review", variant: "info", icon: Clapperboard },
  needs_changes: { label: "Cần chỉnh sửa", variant: "warning", icon: RefreshCw },
} as const

const statusOptions = Object.keys(statuses) as SceneStatus[]

function SceneTypeBadge({ value }: { value: Scene["sceneType"] }) {
  const presentation = sceneTypes[value]
  return <Badge variant={presentation.variant}>{presentation.label}</Badge>
}

function MediaBadge({ value }: { value: Scene["defaultMediaType"] }) {
  const Icon = value === "image" ? ImageIcon : Video
  return <Badge variant={value === "image" ? "info" : "lavender"}><Icon aria-hidden="true" className="size-3" />{value === "image" ? "Image" : "Video"}</Badge>
}

function SceneStatusBadge({ value }: { value: SceneStatus }) {
  const presentation = statuses[value]
  const Icon = presentation.icon
  return <Badge variant={presentation.variant} className="px-2.5 py-1"><Icon aria-hidden="true" className="size-3" />{presentation.label}</Badge>
}

function SceneRow({ scene, index, selected, reordering, isFirst, isLast, onSelect, onMove, onDragStart, onDrop }: {
  scene: Scene
  index: number
  selected: boolean
  reordering: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onMove: (direction: -1 | 1) => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role={reordering ? "listitem" : "option"}
      aria-selected={reordering ? undefined : selected}
      tabIndex={reordering ? -1 : 0}
      draggable={reordering}
      onClick={reordering ? undefined : onSelect}
      onKeyDown={(event) => {
        if (!reordering && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          onSelect()
        }
      }}
      onDragStart={onDragStart}
      onDragOver={(event) => reordering && event.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group grid min-h-[88px] grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2.5 outline-none transition-colors [contain-intrinsic-size:auto_88px] [content-visibility:auto] last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30",
        selected ? "bg-selected" : "bg-surface hover:bg-muted/35",
        reordering && "cursor-grab select-none active:cursor-grabbing",
      )}
    >
      <span aria-hidden="true" className={cn("grid size-4 place-items-center rounded-[4px] border", selected ? "border-accent bg-accent text-white" : "border-border-strong bg-surface")}>{selected && <Check className="size-3" strokeWidth={3} />}</span>
      <div className="flex items-center gap-1.5 text-muted-foreground"><GripVertical aria-hidden="true" className="size-4" /><span className="w-6 text-center text-xs font-bold tabular-nums text-primary">{String(index + 1).padStart(2, "0")}</span></div>
      <div className="flex min-w-0 items-center gap-3">
        <div aria-hidden="true" className="grid h-[62px] w-[104px] shrink-0 place-items-center rounded-md border border-border bg-muted/55 text-muted-foreground">
          <span className="text-center"><Clapperboard className="mx-auto size-5" /><span className="mt-1 block font-mono text-[10px]">C{String(scene.canonicalNo).padStart(2, "0")}</span></span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-primary">{scene.title}</p>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden"><SceneTypeBadge value={scene.sceneType} /><MediaBadge value={scene.defaultMediaType} /></div>
          <p className="mt-1 line-clamp-1 text-xs leading-4 text-muted-foreground">{scene.narration || "Chưa có narration"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-1">
        {reordering ? (
          <div className="flex flex-col gap-1">
            <button type="button" aria-label={`Đưa ${scene.title} lên trên`} disabled={isFirst} onClick={() => onMove(-1)} className="grid size-6 place-items-center rounded border border-input bg-surface text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:opacity-30"><ArrowUp aria-hidden="true" className="size-3" /></button>
            <button type="button" aria-label={`Đưa ${scene.title} xuống dưới`} disabled={isLast} onClick={() => onMove(1)} className="grid size-6 place-items-center rounded border border-input bg-surface text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:opacity-30"><ArrowDown aria-hidden="true" className="size-3" /></button>
          </div>
        ) : <SceneStatusBadge value={scene.status} />}
      </div>
    </div>
  )
}

function AssetSlotSummary({ slots }: { slots: AssetSlot[] }) {
  return (
    <section className="mt-4 border-t border-border pt-4" aria-labelledby="scene-slot-title">
      <div className="flex items-center justify-between gap-3"><h4 id="scene-slot-title" className="text-xs font-bold text-primary">Media prompts đã import</h4><Badge variant="neutral">{slots.length} slot</Badge></div>
      {slots.length ? (
        <div className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border">
          {slots.map((slot) => (
            <div key={slot.id} className="bg-background/35 px-3 py-2.5 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5"><code className="font-mono font-bold text-primary">{slot.canonicalName}</code><Badge variant={slot.mediaType === "image" ? "info" : "lavender"}>{slot.mediaType}</Badge><Badge variant={slot.status === "ready" ? "success" : "neutral"}>{slot.status}</Badge>{slot.required && <span className="text-muted-foreground">Bắt buộc</span>}</div>
              <p className="mt-1.5 whitespace-pre-wrap leading-4 text-muted-foreground">{slot.prompt || "Chưa có prompt"}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-2 text-[11px] text-muted-foreground">Scene này chưa có AssetSlot.</p>}
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">M7 chỉ hiển thị mapping đã import. Chỉnh sửa AssetSlot thuộc M8.</p>
    </section>
  )
}

function SceneEditor({ detail, draft, fieldErrors, actionError, saving, selectedIndex, total, onDraftChange, onSave, onTransition, onReload, onPrevious, onNext }: {
  detail: SceneDetail
  draft: SceneDraft
  fieldErrors: Partial<Record<keyof SceneDraft, string>>
  actionError: string
  saving: boolean
  selectedIndex: number
  total: number
  onDraftChange: <Key extends keyof SceneDraft>(key: Key, value: SceneDraft[Key]) => void
  onSave: () => void
  onTransition: (status: SceneStatus) => void
  onReload: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  const [nextStatus, setNextStatus] = useState<SceneStatus>(detail.status)
  useEffect(() => setNextStatus(detail.status), [detail.id, detail.status])
  const dirty = Object.keys(sceneDraftPatch(detail, draft)).length > 0

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel" aria-labelledby="scene-detail-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5"><FileText aria-hidden="true" className="size-[18px] text-primary" /><h2 id="scene-detail-title" className="text-section-title text-primary">Chi tiết cảnh</h2></div>
        <div className="flex gap-1.5"><Button type="button" variant="outline" size="icon-sm" aria-label="Cảnh trước" disabled={selectedIndex <= 0 || saving} onClick={onPrevious}><ChevronLeft aria-hidden="true" /></Button><Button type="button" variant="outline" size="icon-sm" aria-label="Cảnh tiếp theo" disabled={selectedIndex >= total - 1 || saving} onClick={onNext}><ChevronRight aria-hidden="true" /></Button></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold tracking-[-0.015em] text-primary">{String(detail.displayOrder).padStart(2, "0")}. {detail.title}</h3>
        <SceneStatusBadge value={detail.status} />
        {dirty && <Badge variant="warning">Chưa lưu</Badge>}
        <code className="ml-auto text-[10px] text-muted-foreground">canonical {String(detail.canonicalNo).padStart(2, "0")}</code>
      </div>
      {actionError && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs leading-5 text-danger"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 flex-1">{actionError}</span><Button type="button" variant="ghost" size="sm" onClick={onReload}>Nạp bản đã lưu</Button></div>
      )}
      <div className="mt-4 space-y-3">
        <Field label="Tiêu đề" htmlFor="scene-title" required error={fieldErrors.title} meta={`${draft.title.length}/120`}><Input id="scene-title" required value={draft.title} maxLength={120} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "scene-title-error" : undefined} onChange={(event) => onDraftChange("title", event.target.value)} /></Field>
        <Field label="Tóm tắt" htmlFor="scene-summary" error={fieldErrors.summary} meta={`${draft.summary.length}/500`}><Textarea id="scene-summary" value={draft.summary} maxLength={500} aria-invalid={Boolean(fieldErrors.summary)} aria-describedby={fieldErrors.summary ? "scene-summary-error" : undefined} className="min-h-[60px] resize-y text-xs" onChange={(event) => onDraftChange("summary", event.target.value)} /></Field>
        <Field label="Narration / Lời dẫn" htmlFor="scene-narration" error={fieldErrors.narration} meta={`${draft.narration.length}/10000`} description="Bắt buộc trước khi duyệt Scene."><Textarea id="scene-narration" value={draft.narration} maxLength={10_000} aria-invalid={Boolean(fieldErrors.narration)} aria-describedby={fieldErrors.narration ? "scene-narration-error" : "scene-narration-description"} className="min-h-[92px] resize-y text-xs leading-[1.45]" onChange={(event) => onDraftChange("narration", event.target.value)} /></Field>
        <Field label="Mô tả hình ảnh" htmlFor="scene-visual" error={fieldErrors.visualDescription} meta={`${draft.visualDescription.length}/5000`} description="Bắt buộc trước khi duyệt Scene."><Textarea id="scene-visual" value={draft.visualDescription} maxLength={5_000} aria-invalid={Boolean(fieldErrors.visualDescription)} aria-describedby={fieldErrors.visualDescription ? "scene-visual-error" : "scene-visual-description"} className="min-h-[92px] resize-y text-xs leading-[1.45]" onChange={(event) => onDraftChange("visualDescription", event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Loại cảnh" htmlFor="scene-type" required><Select id="scene-type" label="Loại cảnh" value={draft.sceneType} onChange={(event) => onDraftChange("sceneType", event.target.value as Scene["sceneType"])}>{(Object.keys(sceneTypes) as Scene["sceneType"][]).map((value) => <option key={value} value={value}>{sceneTypes[value].label}</option>)}</Select></Field>
          <Field label="Media mặc định" htmlFor="scene-media" required><Select id="scene-media" label="Media mặc định" value={draft.defaultMediaType} onChange={(event) => onDraftChange("defaultMediaType", event.target.value as Scene["defaultMediaType"])}><option value="image">Image</option><option value="video">Video</option></Select></Field>
        </div>
        <Field label="Ghi chú" htmlFor="scene-notes" error={fieldErrors.notes} meta={`${draft.notes.length}/2000`} description="Chỉ sửa ghi chú sẽ không làm Scene đã duyệt quay về draft."><Textarea id="scene-notes" value={draft.notes} maxLength={2_000} aria-invalid={Boolean(fieldErrors.notes)} aria-describedby={fieldErrors.notes ? "scene-notes-error" : "scene-notes-description"} className="min-h-[70px] resize-y text-xs leading-[1.45]" onChange={(event) => onDraftChange("notes", event.target.value)} /></Field>
      </div>
      <AssetSlotSummary slots={detail.assetSlots} />
      {detail.provenance && <div className="mt-3 rounded-md bg-muted/45 px-3 py-2 text-[10px] leading-4 text-muted-foreground">Import batch <code className="font-mono text-primary">{detail.provenance.id.slice(0, 8)}</code> · TemplateVersion <code className="font-mono text-primary">{detail.provenance.templateVersionId.slice(0, 8)}</code></div>}
      <div className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <Button type="button" variant="outline" disabled={!dirty || saving} onClick={onSave}>{saving ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" />}Lưu nháp</Button>
        <Select id="scene-review-status" label="Trạng thái review" value={nextStatus} disabled={saving} onChange={(event) => setNextStatus(event.target.value as SceneStatus)}>{statusOptions.map((status) => <option key={status} value={status}>{statuses[status].label}</option>)}</Select>
        <Button type="button" variant={nextStatus === "approved" ? "accent" : "outline"} disabled={saving || (!dirty && nextStatus === detail.status)} onClick={() => onTransition(nextStatus)}>{nextStatus === "approved" ? <Check aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}{nextStatus === "approved" ? "Duyệt cảnh" : "Áp dụng"}</Button>
      </div>
    </section>
  )
}

function FlowSteps() {
  return <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Quy trình tạo và import Scenes">{["Chọn TemplateVersion", "Render và copy prompt", "Dùng ChatGPT thủ công", "Preview rồi import JSON"].map((label, index) => <li key={label} className="flex min-w-0 items-start gap-1.5 text-[10px] leading-[1.25] text-primary"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">{index + 1}</span><span className="pt-0.5 text-pretty">{label}</span></li>)}</ol>
}

function CreateScenesCard({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel" aria-labelledby="create-scenes-title">
      <div className="flex items-center gap-2.5"><CirclePlus aria-hidden="true" className="size-[18px] text-primary" /><h2 id="create-scenes-title" className="text-section-title text-primary">Tạo / Import Scenes</h2></div>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Chọn phiên bản template, copy prompt sang ChatGPT rồi preview JSON trước khi ghi.</p>
      <FlowSteps />
      <Button type="button" variant="accent" className="mt-3 w-full" disabled={disabled} onClick={onOpen}><Sparkles aria-hidden="true" />Mở flow tạo Scenes</Button>
      <div className="mt-2.5 flex items-start gap-2 rounded-md bg-info-soft px-3 py-2 text-[11px] leading-4 text-info"><Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><p>Ứng dụng không gọi AI. Nội dung nguồn, prompt đã render và raw JSON chỉ tồn tại trong phiên.</p></div>
    </section>
  )
}

function variableInput(variable: TemplateVariableDefinition, value: string, onChange: (value: string) => void) {
  const id = `scene-variable-${variable.id}`
  const describedBy = variable.description ? `${id}-description` : undefined
  if (variable.type === "multiline") return <Textarea id={id} aria-required={variable.required} aria-describedby={describedBy} value={value} className="min-h-[68px] resize-y text-xs" onChange={(event) => onChange(event.target.value)} />
  if (variable.type === "select") return <Select id={id} label={variable.label} aria-required={variable.required} aria-describedby={describedBy} value={value} onChange={(event) => onChange(event.target.value)}>{!variable.required && <option value="">Không chọn</option>}{variable.options.map((option) => <option key={option} value={option}>{option}</option>)}</Select>
  return <Input id={id} type={variable.type === "number" ? "number" : "text"} aria-required={variable.required} aria-describedby={describedBy} value={value} onChange={(event) => onChange(event.target.value)} />
}

type ImportPreviewState = {
  preview: ScenesImportPreview
  rawJson: string
  mode: ImportMode
  templateVersionId: string
  renderedPromptHash?: string
  baseSceneSignature: string
}

function ScenesJsonSampleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")

  useEffect(() => {
    if (!open) setCopyState("idle")
  }, [open])

  async function copySample() {
    try {
      await navigator.clipboard.writeText(scenesJsonV1Sample)
      setCopyState("copied")
    } catch {
      setCopyState("error")
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-primary/32 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in motion-reduce:animate-none" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[91] flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-overlay focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="flex items-center gap-2 text-base font-bold text-primary"><FileJson aria-hidden="true" className="size-5 text-accent" />JSON mẫu Scenes v1</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-muted-foreground">Mẫu đầy đủ theo strict contract hiện tại, gồm một Scene và các AssetSlot. Tự sao chép rồi dán vào nội dung Template hoặc ô JSON khi cần.</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"><X aria-hidden="true" className="size-4" /><span className="sr-only">Đóng JSON mẫu</span></DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-background/45 p-4">
            <pre className="min-w-max whitespace-pre rounded-md border border-border bg-primary px-4 py-3 font-mono text-[11px] leading-5 text-primary-foreground"><code>{scenesJsonV1Sample}</code></pre>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p role={copyState === "error" ? "alert" : "status"} aria-live="polite" className={cn("text-xs", copyState === "copied" ? "text-success" : copyState === "error" ? "text-danger" : "text-muted-foreground")}>
              {copyState === "copied" ? "Đã sao chép JSON mẫu vào clipboard." : copyState === "error" ? "Không thể truy cập clipboard. Bạn vẫn có thể chọn và sao chép thủ công." : "JSON mẫu chỉ để tham khảo, không tự chèn vào Template hoặc prompt."}
            </p>
            <Button type="button" variant="accent" onClick={() => void copySample()}>{copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copyState === "copied" ? "Đã sao chép" : "Sao chép JSON"}</Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function CreateScenesDialog({ open, episode, onOpenChange, prepareEpisodeMutation, refreshEpisode, onImported }: {
  open: boolean
  episode: EpisodeAggregate
  onOpenChange: (open: boolean) => void
  prepareEpisodeMutation: () => Promise<EpisodeAggregate>
  refreshEpisode: () => Promise<EpisodeAggregate>
  onImported: (sceneId: string, message: string) => void
}) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [template, setTemplate] = useState<TemplateAggregate | null>(null)
  const [templateId, setTemplateId] = useState("")
  const [versionId, setVersionId] = useState("")
  const [templateState, setTemplateState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [sourceContent, setSourceContent] = useState("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [rendered, setRendered] = useState<RenderedPrompt | null>(null)
  const [rendering, setRendering] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rawJson, setRawJson] = useState("")
  const [mode, setMode] = useState<ImportMode>("append")
  const [previewState, setPreviewState] = useState<ImportPreviewState | null>(null)
  const [validating, setValidating] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string; fields?: Record<string, string> } | null>(null)
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false)
  const [sampleOpen, setSampleOpen] = useState(false)
  const templateRequest = useRef(0)

  const version = template?.versions.find((item) => item.id === versionId) ?? null
  const customVariables = version?.variables.filter((variable) => !reservedSceneVariableNames.has(variable.name)) ?? []

  async function loadTemplates() {
    const requestId = ++templateRequest.current
    setTemplateState("loading")
    setFeedback(null)
    try {
      const page = await unwrapResult(window.studio.templates.list({ page: 1, pageSize: 100, purpose: "scene", status: "active" }))
      if (requestId !== templateRequest.current) return
      setTemplates(page.items)
      setTemplateId((current) => page.items.some((item) => item.id === current) ? current : (page.items[0]?.id ?? ""))
      setTemplateState("ready")
    } catch {
      if (requestId === templateRequest.current) setTemplateState("error")
    }
  }

  useEffect(() => { if (open) void loadTemplates() }, [open])

  useEffect(() => {
    if (!open || !templateId) {
      setTemplate(null)
      setVersionId("")
      return
    }
    const requestId = ++templateRequest.current
    setTemplateState("loading")
    void unwrapResult(window.studio.templates.get({ id: templateId }))
      .then((aggregate) => {
        if (requestId !== templateRequest.current) return
        setTemplate(aggregate)
        setVersionId(aggregate.versions[0]?.id ?? "")
        setTemplateState("ready")
      })
      .catch(() => { if (requestId === templateRequest.current) setTemplateState("error") })
  }, [open, templateId])

  useEffect(() => {
    if (!version) {
      setValues({})
      return
    }
    setValues(Object.fromEntries(version.variables.filter((variable) => !reservedSceneVariableNames.has(variable.name)).map((variable) => [variable.name, variable.defaultValue])))
    setRendered(null)
    setCopied(false)
    setPreviewState(null)
  }, [version?.id])

  function invalidateRender() {
    setRendered(null)
    setCopied(false)
    setPreviewState(null)
    setFeedback(null)
  }

  async function renderPrompt() {
    if (!versionId) return
    setRendering(true)
    setFeedback(null)
    try {
      const output = await unwrapResult(window.studio.sceneCreation.renderPrompt({ episodeId: episode.id, templateVersionId: versionId, ...(sourceContent.length > 0 ? { sourceContent } : {}), values }))
      setRendered(output)
      setCopied(false)
    } catch (error) {
      setFeedback({ tone: "error", message: errorMessage(error, "Không thể render Scene Template."), ...(error instanceof StudioClientError && error.fieldErrors ? { fields: error.fieldErrors } : {}) })
    } finally {
      setRendering(false)
    }
  }

  async function copyPrompt() {
    if (!rendered) return
    try {
      await navigator.clipboard.writeText(rendered.content)
      setCopied(true)
      setFeedback({ tone: "success", message: "Đã sao chép prompt. Hãy dùng với ChatGPT rồi mang JSON trở lại đây." })
    } catch {
      setFeedback({ tone: "error", message: "Không thể truy cập clipboard. Prompt vẫn được giữ để sao chép thủ công." })
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      setFeedback({ tone: "error", message: "File JSON vượt giới hạn 1 MiB." })
      event.target.value = ""
      return
    }
    try {
      setRawJson(await file.text())
      setPreviewState(null)
      setFeedback(null)
    } catch {
      setFeedback({ tone: "error", message: "Không thể đọc file JSON đã chọn." })
    } finally {
      event.target.value = ""
    }
  }

  async function validateImport() {
    if (!versionId || !rawJson.trim()) return
    setValidating(true)
    setFeedback(null)
    try {
      const preview = await unwrapResult(window.studio.sceneCreation.validateImport({ episodeId: episode.id, templateVersionId: versionId, ...(rendered ? { renderedPromptHash: rendered.contentHash } : {}), mode, rawJson }))
      setPreviewState({ preview, rawJson, mode, templateVersionId: versionId, ...(rendered ? { renderedPromptHash: rendered.contentHash } : {}), baseSceneSignature: sceneStructureSignature(episode.scenes) })
      setFeedback({ tone: "success", message: `JSON hợp lệ: ${preview.sceneCount} Scene, ${preview.slotCount} AssetSlot. Chưa ghi dữ liệu.` })
    } catch (error) {
      setPreviewState(null)
      setFeedback({ tone: "error", message: errorMessage(error, "JSON Scenes không hợp lệ."), ...(error instanceof StudioClientError && error.fieldErrors ? { fields: error.fieldErrors } : {}) })
    } finally {
      setValidating(false)
    }
  }

  async function commitImport() {
    if (!previewState) return
    setReplaceConfirmOpen(false)
    setCommitting(true)
    setFeedback(null)
    try {
      const latestEpisode = await prepareEpisodeMutation()
      if (sceneStructureSignature(latestEpisode.scenes) !== previewState.baseSceneSignature) {
        setPreviewState(null)
        setFeedback({ tone: "error", message: "Danh sách Scene đã thay đổi sau preview. Hãy kiểm tra JSON lại trước khi import." })
        return
      }
      const result = await unwrapResult(window.studio.sceneCreation.commitImport({ episodeId: episode.id, templateVersionId: previewState.templateVersionId, ...(previewState.renderedPromptHash ? { renderedPromptHash: previewState.renderedPromptHash } : {}), mode: previewState.mode, rawJson: previewState.rawJson, payloadHash: previewState.preview.payloadHash, expectedEpisodeRevisionNo: latestEpisode.revisionNo }))
      await refreshEpisode()
      const label = previewState.mode === "replace" ? "thay thế" : "thêm"
      onImported(result.scenes[0]?.id ?? "", `Đã ${label} ${result.scenes.length} Scene và ${result.assetSlots.length} AssetSlot.`)
      setRawJson("")
      setSourceContent("")
      setRendered(null)
      setPreviewState(null)
      onOpenChange(false)
    } catch (error) {
      setFeedback({ tone: "error", message: errorMessage(error, "Không thể import Scenes. JSON và preview vẫn được giữ nguyên."), ...(error instanceof StudioClientError && error.fieldErrors ? { fields: error.fieldErrors } : {}) })
    } finally {
      setCommitting(false)
    }
  }

  const canonicalBase = mode === "append" ? Math.max(0, ...episode.scenes.map((scene) => scene.canonicalNo)) : 0

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-primary/28 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in motion-reduce:animate-none" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[81] max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface p-5 shadow-overlay focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            <div className="flex items-start justify-between gap-4">
              <div><DialogPrimitive.Title className="flex items-center gap-2 text-base font-bold text-primary"><Sparkles aria-hidden="true" className="size-5 text-accent" />Tạo / Import Scenes</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-xs leading-5 text-muted-foreground">Episode “{episode.title}” · flow thủ công, local-first.</DialogPrimitive.Description></div>
              <DialogPrimitive.Close className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"><X aria-hidden="true" className="size-4" /><span className="sr-only">Đóng</span></DialogPrimitive.Close>
            </div>
            <FlowSteps />

            {templateState === "loading" ? <LoadingState /> : templateState === "error" ? <ErrorState onRetry={() => void loadTemplates()} /> : templates.length === 0 ? (
              <EmptyState action={<Button asChild variant="outline" size="sm"><a href={`${window.location.pathname}#templates`}>Mở Templates</a></Button>} />
            ) : (
              <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-border bg-background/45 p-4" aria-labelledby="prompt-section-title">
                  <h3 id="prompt-section-title" className="text-sm font-bold text-primary">1. Chuẩn bị prompt</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Scene Template" htmlFor="scene-template" required meta={<Button type="button" variant="ghost" size="sm" className="h-auto px-1.5 py-0.5" onClick={() => setSampleOpen(true)}><FileJson aria-hidden="true" className="size-3.5" />Xem JSON mẫu</Button>}><Select id="scene-template" label="Scene Template" value={templateId} onChange={(event) => { setTemplateId(event.target.value); invalidateRender() }}>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
                    <Field label="Phiên bản" htmlFor="scene-template-version" required><Select id="scene-template-version" label="Phiên bản Scene Template" value={versionId} onChange={(event) => { setVersionId(event.target.value); invalidateRender() }}>{template?.versions.map((item) => <option key={item.id} value={item.id}>v{item.major}.{item.minor} — {item.changeNote}</option>)}</Select></Field>
                  </div>
                  <Field label="Nội dung nguồn" htmlFor="scene-source-content" description="Tùy chọn và không được lưu vào database." className="mt-3"><Textarea id="scene-source-content" value={sourceContent} className="min-h-[88px] resize-y text-xs" placeholder="Dán outline hoặc nội dung có sẵn…" onChange={(event) => { setSourceContent(event.target.value); invalidateRender() }} /></Field>
                  {customVariables.length > 0 && <div className="mt-3 space-y-3 border-t border-border pt-3"><p className="text-xs font-bold text-primary">Biến bổ sung</p>{customVariables.map((variable) => <Field key={variable.id} label={variable.label} htmlFor={`scene-variable-${variable.id}`} required={variable.required} description={variable.description}>{variableInput(variable, values[variable.name] ?? "", (value) => { setValues((current) => ({ ...current, [variable.name]: value })); invalidateRender() })}</Field>)}</div>}
                  <Button type="button" variant="outline" className="mt-3 w-full" disabled={!versionId || rendering} onClick={() => void renderPrompt()}>{rendering ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Sparkles aria-hidden="true" />}Render prompt</Button>
                  <Field label="Prompt đã render" htmlFor="scene-rendered-prompt" className="mt-3"><Textarea id="scene-rendered-prompt" readOnly value={rendered?.content ?? ""} className="min-h-[170px] resize-y bg-muted/35 font-mono text-[10px] leading-4" placeholder="Render prompt để xem kết quả…" /></Field>
                  <Button type="button" variant="accent" className="mt-3 w-full" disabled={!rendered} onClick={() => void copyPrompt()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Đã sao chép" : "Sao chép prompt"}</Button>
                </section>

                <section className="rounded-lg border border-border bg-background/45 p-4" aria-labelledby="json-section-title">
                  <h3 id="json-section-title" className="text-sm font-bold text-primary">2. Validate và import JSON</h3>
                  <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] leading-4 text-muted-foreground">Strict JSON Scenes v1, tối đa 1 MiB / 200 Scene.</p><label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-surface px-2.5 text-xs font-semibold text-primary hover:bg-muted focus-within:ring-2 focus-within:ring-ring/35"><FileJson aria-hidden="true" className="size-3.5" />Chọn file<Input id="scene-json-file" type="file" accept=".json,application/json" className="sr-only" onChange={(event) => void handleFile(event)} /></label></div>
                  <Textarea id="scene-json-input" aria-label="JSON Scenes" value={rawJson} spellCheck={false} className="mt-2 min-h-[260px] resize-y font-mono text-[10px] leading-4" placeholder={'{\n  "schemaVersion": 1,\n  "scenes": []\n}'} onChange={(event) => { setRawJson(event.target.value); setPreviewState(null); setFeedback(null) }} />
                  <Field label="Cách áp dụng" htmlFor="scene-import-mode" className="mt-3"><Select id="scene-import-mode" label="Cách áp dụng JSON" value={mode} onChange={(event) => { setMode(event.target.value as ImportMode); setPreviewState(null); setFeedback(null) }}><option value="append">Thêm vào cuối danh sách</option><option value="replace">Thay thế graph hiện tại (chỉ khi asset-free)</option></Select></Field>
                  <Button type="button" variant="outline" className="mt-3 w-full" disabled={!versionId || !rawJson.trim() || validating || committing} onClick={() => void validateImport()}>{validating ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden="true" />}Kiểm tra JSON</Button>
                  {feedback && <div role={feedback.tone === "error" ? "alert" : "status"} className={cn("mt-3 rounded-md px-3 py-2 text-xs", feedback.tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}><p>{feedback.message}</p>{feedback.fields && <ul className="mt-1 list-disc space-y-0.5 pl-4">{Object.entries(feedback.fields).map(([field, message]) => <li key={field}><code>{field}</code>: {message}</li>)}</ul>}</div>}
                </section>
              </div>
            )}

            {previewState && (
              <section className="mt-4 rounded-lg border border-border bg-surface" aria-labelledby="import-preview-title">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h3 id="import-preview-title" className="text-sm font-bold text-primary">Preview thay đổi</h3><p className="mt-0.5 text-[11px] text-muted-foreground">Hash {previewState.preview.payloadHash.slice(0, 12)}… · chưa ghi database</p></div><div className="flex gap-2"><Badge variant="info">{previewState.preview.sceneCount} Scene</Badge><Badge variant="lavender">{previewState.preview.slotCount} Slot</Badge></div></div>
                {previewState.preview.warnings.length > 0 && <ul className="border-b border-border bg-warning-soft px-4 py-2 text-[11px] leading-4 text-warning">{previewState.preview.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>}
                <div className="max-h-72 divide-y divide-border overflow-y-auto">
                  {previewState.preview.document.scenes.map((scene, index) => {
                    const canonicalNo = canonicalBase + index + 1
                    return <div key={`${scene.order}-${scene.title}`} className="grid gap-2 px-4 py-3 text-xs lg:grid-cols-[3rem_minmax(0,1fr)_minmax(16rem,0.8fr)]"><div className="font-mono font-bold text-primary">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0"><p className="font-bold text-primary">{scene.title}</p><p className="mt-1 line-clamp-2 leading-4 text-muted-foreground">{scene.narration}</p><div className="mt-1.5 flex gap-1.5"><SceneTypeBadge value={scene.sceneType} /><MediaBadge value={scene.mediaType} /></div></div><div className="space-y-1.5">{scene.assetSlots.map((slot) => <div key={slot.order} className="rounded border border-border bg-background/45 px-2 py-1.5"><code className="font-mono font-bold text-primary">scene-{String(canonicalNo).padStart(2, "0")}-{String(slot.order).padStart(2, "0")}</code><p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">{slot.prompt}</p></div>)}</div></div>
                  })}
                </div>
                <div className="flex justify-end border-t border-border p-3"><Button type="button" variant="accent" disabled={committing} onClick={() => previewState.mode === "replace" ? setReplaceConfirmOpen(true) : void commitImport()}>{committing ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" />}{previewState.mode === "replace" ? "Xác nhận replace" : "Import Scenes"}</Button></div>
              </section>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <ScenesJsonSampleDialog open={sampleOpen} onOpenChange={setSampleOpen} />
      <ConfirmDialog open={replaceConfirmOpen} onOpenChange={setReplaceConfirmOpen} title="Thay thế toàn bộ Scene hiện tại?" description="Toàn bộ Scene, AssetSlot và import provenance asset-free hiện tại sẽ được thay bằng preview này. Canonical numbering sẽ bắt đầu lại từ 1." cancelLabel="Giữ dữ liệu hiện tại" confirmLabel="Replace Scenes" onConfirm={() => void commitImport()} />
    </>
  )
}

function ReorderPreviewDialog({ open, scenes, orderedIds, slots, saving, onOpenChange, onConfirm }: {
  open: boolean
  scenes: Scene[]
  orderedIds: string[]
  slots: AssetSlot[]
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]))
  const mappedSlots = slotsByScene(slots)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-primary/28 backdrop-blur-[1px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[81] max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface p-5 shadow-overlay focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
          <DialogPrimitive.Title className="text-base font-bold text-primary">Xác nhận thứ tự Scene</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-muted-foreground">Chỉ display order thay đổi. Canonical number và tên AssetSlot bên dưới được giữ nguyên.</DialogPrimitive.Description>
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border">
            {orderedIds.map((id, index) => {
              const scene = sceneMap.get(id)
              if (!scene) return null
              return <div key={id} className="grid gap-2 bg-background/35 px-3 py-2.5 text-xs sm:grid-cols-[6rem_minmax(0,1fr)]"><div><span className="font-bold text-primary">{String(scene.displayOrder).padStart(2, "0")} → {String(index + 1).padStart(2, "0")}</span><code className="mt-1 block font-mono text-[10px] text-muted-foreground">C{String(scene.canonicalNo).padStart(2, "0")} giữ nguyên</code></div><div className="min-w-0"><p className="truncate font-semibold text-primary">{scene.title}</p><p className="mt-1 break-words font-mono text-[10px] text-muted-foreground">{(mappedSlots.get(id) ?? []).map((slot) => slot.canonicalName).join(" · ") || "Chưa có AssetSlot"}</p></div></div>
            })}
          </div>
          <div className="mt-4 flex justify-end gap-2"><DialogPrimitive.Close asChild><Button type="button" variant="outline" disabled={saving}>Quay lại</Button></DialogPrimitive.Close><Button type="button" variant="accent" disabled={saving} onClick={onConfirm}>{saving ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" />}Lưu thứ tự</Button></div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function EpisodeScenesTab({ episode, prepareEpisodeMutation, refreshEpisode, onDirtyChange }: {
  episode: EpisodeAggregate
  prepareEpisodeMutation: () => Promise<EpisodeAggregate>
  refreshEpisode: () => Promise<EpisodeAggregate>
  onDirtyChange: (dirty: boolean) => void
}) {
  const orderedEpisodeScenes = useMemo(() => [...episode.scenes].sort((left, right) => left.displayOrder - right.displayOrder), [episode.scenes])
  const [scenes, setScenes] = useState<Scene[]>(orderedEpisodeScenes)
  const [selectedId, setSelectedId] = useState(orderedEpisodeScenes[0]?.id ?? "")
  const [detail, setDetail] = useState<SceneDetail | null>(null)
  const [draft, setDraft] = useState<SceneDraft | null>(null)
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "error">(orderedEpisodeScenes.length ? "loading" : "idle")
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SceneDraft, string>>>({})
  const [actionError, setActionError] = useState("")
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | SceneStatus>("all")
  const [sceneType, setSceneType] = useState<SceneTypeFilter>("all")
  const [sort, setSort] = useState<SceneSort>("manual")
  const [flowOpen, setFlowOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [orderDraft, setOrderDraft] = useState<string[]>([])
  const [reorderBaseSignature, setReorderBaseSignature] = useState("")
  const [reorderSlots, setReorderSlots] = useState<AssetSlot[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [reorderPreviewOpen, setReorderPreviewOpen] = useState(false)
  const [reorderSaving, setReorderSaving] = useState(false)
  const detailRequest = useRef(0)

  const dirty = Boolean(detail && draft && Object.keys(sceneDraftPatch(detail, draft)).length > 0)
  const reorderDirty = reordering && orderChanged(scenes, orderDraft)

  useEffect(() => onDirtyChange(dirty || reorderDirty), [dirty, onDirtyChange, reorderDirty])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  useEffect(() => {
    if (dirty || reordering) return
    setScenes(orderedEpisodeScenes)
    setSelectedId((current) => orderedEpisodeScenes.some((scene) => scene.id === current) ? current : (orderedEpisodeScenes[0]?.id ?? ""))
  }, [dirty, orderedEpisodeScenes, reordering])

  async function loadDetail(id: string) {
    if (!id) {
      setDetail(null)
      setDraft(null)
      setDetailState("idle")
      return
    }
    const requestId = ++detailRequest.current
    setDetailState("loading")
    setActionError("")
    try {
      const loaded = await unwrapResult(window.studio.scenes.get({ id }))
      if (requestId !== detailRequest.current) return
      setDetail(loaded)
      setDraft(sceneToDraft(loaded))
      setFieldErrors({})
      setDetailState("ready")
    } catch {
      if (requestId === detailRequest.current) setDetailState("error")
    }
  }

  useEffect(() => { void loadDetail(selectedId) }, [selectedId])

  const selectedIndex = scenes.findIndex((scene) => scene.id === selectedId)
  const filteredScenes = useMemo(() => {
    if (reordering) return orderDraft.flatMap((id) => scenes.find((scene) => scene.id === id) ?? [])
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    const result = scenes.filter((scene) => {
      const matchesQuery = !normalizedQuery || [scene.title, scene.narration, scene.visualDescription].some((value) => value.toLocaleLowerCase("vi").includes(normalizedQuery))
      return matchesQuery && (status === "all" || scene.status === status) && (sceneType === "all" || scene.sceneType === sceneType)
    })
    if (sort === "title") return [...result].sort((left, right) => left.title.localeCompare(right.title, "vi"))
    if (sort === "updated") return [...result].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    return [...result].sort((left, right) => left.displayOrder - right.displayOrder)
  }, [orderDraft, query, reordering, sceneType, scenes, sort, status])

  function requestSelect(id: string) {
    if (id === selectedId) return
    if (dirty) setPendingSelectedId(id)
    else setSelectedId(id)
  }

  function mapServerFieldErrors(error: StudioClientError) {
    const mapped: Partial<Record<keyof SceneDraft, string>> = {}
    if (!detail) return mapped
    const detailDraft = sceneToDraft(detail)
    for (const [path, message] of Object.entries(error.fieldErrors ?? {})) {
      const key = path.split(".").at(-1) as keyof SceneDraft
      if (key in detailDraft) mapped[key] = message
    }
    return mapped
  }

  async function saveDraft() {
    if (!detail || !draft) return null
    const errors = validateSceneDraft(draft)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setActionError("Hãy sửa các field không hợp lệ trước khi lưu.")
      return null
    }
    const patch = sceneDraftPatch(detail, draft)
    if (Object.keys(patch).length === 0) return detail
    setSaving(true)
    setActionError("")
    try {
      const updated = await unwrapResult(window.studio.scenes.update({ id: detail.id, expectedRevisionNo: detail.revisionNo, patch }))
      setScenes((current) => current.map((scene) => scene.id === updated.id ? updated : scene))
      const loaded = await unwrapResult(window.studio.scenes.get({ id: updated.id }))
      setDetail(loaded)
      setDraft(sceneToDraft(loaded))
      setFieldErrors({})
      setNotice(updated.status === "draft" && detail.status === "approved" ? "Đã lưu; Scene quay về draft vì nội dung đã thay đổi." : "Đã lưu Scene.")
      return loaded
    } catch (error) {
      if (error instanceof StudioClientError && error.fieldErrors) setFieldErrors(mapServerFieldErrors(error))
      setActionError(errorMessage(error, "Không thể lưu Scene. Bản nháp vẫn được giữ nguyên."))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function transitionStatus(nextStatus: SceneStatus) {
    if (!detail) return
    let current: SceneDetail | null = detail
    if (dirty) current = await saveDraft()
    if (!current || current.status === nextStatus) return
    setSaving(true)
    setActionError("")
    try {
      const updated = await unwrapResult(window.studio.scenes.transitionStatus({ id: current.id, status: nextStatus, expectedRevisionNo: current.revisionNo }))
      setScenes((items) => items.map((scene) => scene.id === updated.id ? updated : scene))
      await loadDetail(updated.id)
      await refreshEpisode()
      setNotice(nextStatus === "approved" ? "Scene đã được duyệt." : `Đã chuyển Scene sang “${statuses[nextStatus].label}”.`)
    } catch (error) {
      if (error instanceof StudioClientError && error.fieldErrors) setFieldErrors(mapServerFieldErrors(error))
      setActionError(errorMessage(error, "Không thể cập nhật trạng thái Scene."))
    } finally {
      setSaving(false)
    }
  }

  async function beginReorder() {
    if (dirty) {
      setActionError("Hãy lưu hoặc bỏ bản nháp Scene trước khi sắp xếp.")
      return
    }
    setActionError("")
    try {
      const slots = await unwrapResult(window.studio.assetSlots.list({ episodeId: episode.id }))
      setReorderSlots(slots)
      setOrderDraft([...scenes].sort((left, right) => left.displayOrder - right.displayOrder).map((scene) => scene.id))
      setReorderBaseSignature(sceneStructureSignature(scenes))
      setQuery("")
      setStatus("all")
      setSceneType("all")
      setSort("manual")
      setReordering(true)
    } catch (error) {
      setActionError(errorMessage(error, "Không thể tải canonical mapping để sắp xếp."))
    }
  }

  function cancelReorder() {
    setReordering(false)
    setOrderDraft([])
    setReorderPreviewOpen(false)
    setDraggedId(null)
  }

  async function commitReorder() {
    if (!reorderDirty) {
      cancelReorder()
      return
    }
    setReorderSaving(true)
    setActionError("")
    try {
      const latestEpisode = await prepareEpisodeMutation()
      if (sceneStructureSignature(latestEpisode.scenes) !== reorderBaseSignature) {
        setActionError("Danh sách Scene đã thay đổi trong lúc sắp xếp. Thứ tự nháp vẫn được giữ; hãy tải lại trước khi lưu.")
        setReorderPreviewOpen(false)
        return
      }
      const updated = await unwrapResult(window.studio.scenes.reorder({ episodeId: episode.id, orderedSceneIds: orderDraft, expectedEpisodeRevisionNo: latestEpisode.revisionNo }))
      setScenes(updated)
      cancelReorder()
      await refreshEpisode()
      await loadDetail(selectedId)
      setNotice("Đã lưu display order. Canonical mapping không thay đổi.")
    } catch (error) {
      setActionError(errorMessage(error, "Không thể lưu thứ tự. Thứ tự nháp vẫn được giữ nguyên."))
      setReorderPreviewOpen(false)
    } finally {
      setReorderSaving(false)
    }
  }

  return (
    <>
      {notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-success/15 bg-success-soft px-3 py-2 text-xs text-success"><span>{notice}</span><button type="button" aria-label="Ẩn thông báo" onClick={() => setNotice("")} className="rounded p-0.5 hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/35"><X aria-hidden="true" className="size-3.5" /></button></div>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(23rem,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-panel" aria-labelledby="scene-list-title">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex items-center gap-2.5"><Clapperboard aria-hidden="true" className="size-5 text-primary" /><h2 id="scene-list-title" className="text-base font-bold text-primary">Danh sách cảnh ({scenes.length})</h2></div><p className="mt-0.5 pl-[30px] text-[11px] text-muted-foreground">Persisted Scenes theo display order; canonical number độc lập.</p></div>
            <div className="flex gap-2">
              <Button type="button" variant="accent" disabled={reordering || dirty} onClick={() => setFlowOpen(true)}><CirclePlus aria-hidden="true" />Tạo / Import</Button>
              {reordering ? <><Button type="button" variant="outline" onClick={cancelReorder}>Hủy</Button><Button type="button" variant="accent" disabled={!reorderDirty} onClick={() => setReorderPreviewOpen(true)}><Save aria-hidden="true" />Xem trước</Button></> : <Button type="button" variant="outline" disabled={scenes.length < 2} onClick={() => void beginReorder()}><ListFilter aria-hidden="true" />Sắp xếp</Button>}
            </div>
          </div>
          {!reordering && <div className="scene-toolbar grid gap-2 border-b border-border bg-background/25 p-3 md:grid-cols-2"><SearchField name="scene-search" label="Tìm kiếm cảnh" value={query} placeholder="Tìm cảnh, lời dẫn…" onChange={(event) => setQuery(event.target.value)} /><Select id="scene-status-filter" label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value as "all" | SceneStatus)}><option value="all">Tất cả trạng thái</option>{statusOptions.map((value) => <option key={value} value={value}>{statuses[value].label}</option>)}</Select><Select id="scene-type-filter" label="Lọc loại cảnh" value={sceneType} onChange={(event) => setSceneType(event.target.value as SceneTypeFilter)}><option value="all">Tất cả loại cảnh</option>{(Object.keys(sceneTypes) as Scene["sceneType"][]).map((value) => <option key={value} value={value}>{sceneTypes[value].label}</option>)}</Select><Select id="scene-sort" label="Sắp xếp cảnh" value={sort} onChange={(event) => setSort(event.target.value as SceneSort)}><option value="manual">Thứ tự thủ công</option><option value="updated">Cập nhật gần nhất</option><option value="title">Tiêu đề A–Z</option></Select></div>}
          <div role={reordering ? "list" : "listbox"} aria-label="Danh sách cảnh" className="max-h-[650px] overflow-y-auto">
            {filteredScenes.length ? filteredScenes.map((scene, index) => <SceneRow key={scene.id} scene={scene} index={reordering ? index : scene.displayOrder - 1} selected={scene.id === selectedId} reordering={reordering} isFirst={index === 0} isLast={index === filteredScenes.length - 1} onSelect={() => !reordering && requestSelect(scene.id)} onMove={(direction) => setOrderDraft((current) => moveSceneId(current, scene.id, direction))} onDragStart={(event) => { setDraggedId(scene.id); event.dataTransfer.effectAllowed = "move" }} onDrop={(event) => { event.preventDefault(); if (draggedId) setOrderDraft((current) => dropSceneId(current, draggedId, scene.id)); setDraggedId(null) }} />) : scenes.length === 0 ? <EmptyState action={<Button type="button" variant="accent" size="sm" onClick={() => setFlowOpen(true)}>Tạo / Import Scenes</Button>} /> : <EmptyState />}
          </div>
        </section>
        <div className="min-w-0 space-y-4">
          {detailState === "loading" ? <div className="rounded-lg border border-border bg-surface shadow-panel"><LoadingState /></div> : detailState === "error" ? <div className="rounded-lg border border-border bg-surface shadow-panel"><ErrorState onRetry={() => void loadDetail(selectedId)} /></div> : detail && draft ? <SceneEditor detail={detail} draft={draft} fieldErrors={fieldErrors} actionError={actionError} saving={saving} selectedIndex={selectedIndex} total={scenes.length} onDraftChange={(key, value) => { setDraft((current) => current ? { ...current, [key]: value } : current); setFieldErrors((current) => ({ ...current, [key]: undefined })); setActionError("") }} onSave={() => void saveDraft()} onTransition={(nextStatus) => void transitionStatus(nextStatus)} onReload={() => void loadDetail(selectedId)} onPrevious={() => requestSelect(scenes[selectedIndex - 1]?.id ?? selectedId)} onNext={() => requestSelect(scenes[selectedIndex + 1]?.id ?? selectedId)} /> : null}
          <CreateScenesCard disabled={dirty || reordering} onOpen={() => setFlowOpen(true)} />
        </div>
      </div>
      <CreateScenesDialog open={flowOpen} episode={episode} onOpenChange={setFlowOpen} prepareEpisodeMutation={prepareEpisodeMutation} refreshEpisode={refreshEpisode} onImported={(sceneId, message) => { setNotice(message); if (sceneId) setSelectedId(sceneId) }} />
      <ConfirmDialog open={Boolean(pendingSelectedId)} onOpenChange={(open) => !open && setPendingSelectedId(null)} title="Bỏ thay đổi Scene chưa lưu?" description="Bản nháp trong editor hiện tại sẽ bị bỏ khi chuyển sang Scene khác." cancelLabel="Tiếp tục chỉnh sửa" confirmLabel="Bỏ thay đổi" onConfirm={() => { const next = pendingSelectedId; setPendingSelectedId(null); if (next) setSelectedId(next) }} />
      <ReorderPreviewDialog open={reorderPreviewOpen} scenes={scenes} orderedIds={orderDraft} slots={reorderSlots} saving={reorderSaving} onOpenChange={setReorderPreviewOpen} onConfirm={() => void commitReorder()} />
    </>
  )
}

export { EpisodeScenesTab }
