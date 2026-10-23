import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  GripVertical,
  History,
  Info,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  cloneVariables,
  getCurrentVersion,
  getNextVersion,
  purposeLabels,
  statusPresentation,
  thumbnailByPurpose,
  type Purpose,
  type TemplateRecord,
  type TemplateStatus,
  type TemplateVariableDefinition,
  type TemplateVersion,
  type VariableType,
} from "@/components/template-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { ErrorState, LoadingState } from "@/components/ui/state-feedback"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type AuthoringMode = "create" | "edit"
type AuthoringStep = 1 | 2 | 3
type RailView = "preview" | "history"
type DemoState = "ready" | "loading" | "error" | "save-error"

type TemplateDraft = {
  name: string
  purpose: Purpose
  description: string
  status: TemplateStatus
  content: string
  variables: TemplateVariableDefinition[]
  changeNote: string
}

type FieldErrors = Record<string, string>
type LeaveIntent = { kind: "cancel" } | { kind: "anchor"; href: string }

const purposeOptions = Object.entries(purposeLabels) as Array<[Purpose, string]>
const statusOptions = Object.entries(statusPresentation) as Array<
  [TemplateStatus, (typeof statusPresentation)[TemplateStatus]]
>
const railTabs: readonly TabItem<RailView>[] = [
  { value: "preview", label: "Xem trước" },
  { value: "history", label: "Lịch sử" },
]

const defaultPrompt = `Bạn là một biên tập viên YouTube chuyên nghiệp.
Hãy viết kịch bản chi tiết cho video về: “{{topic}}”
Thời lượng: khoảng {{duration}} phút.

Yêu cầu:
- Cấu trúc: Hook, mở đầu, nội dung chính, ví dụ thực tế, kết luận.
- Giọng văn: {{tone}}.
- Đưa ra các ý chính:
{{key_points}}

Định dạng rõ ràng, dễ hiểu, dùng ngôn ngữ tự nhiên,
gần gũi và phù hợp với phong cách Ngộ Dậy Studio.`

const defaultVariables: TemplateVariableDefinition[] = [
  {
    id: "draft-topic",
    name: "topic",
    label: "Chủ đề video",
    description: "Chủ đề chính cần triển khai trong kịch bản.",
    type: "text",
    required: true,
    defaultValue: "Tại sao có cảm giác Déjà vu?",
    options: [],
  },
  {
    id: "draft-duration",
    name: "duration",
    label: "Độ dài (phút)",
    description: "Thời lượng mục tiêu của video.",
    type: "number",
    required: true,
    defaultValue: "10",
    options: [],
  },
  {
    id: "draft-tone",
    name: "tone",
    label: "Giọng văn",
    description: "Phong cách thể hiện xuyên suốt nội dung.",
    type: "select",
    required: true,
    defaultValue: "Hài hước",
    options: ["Hài hước", "Nghiêm túc", "Gần gũi"],
  },
  {
    id: "draft-key-points",
    name: "key_points",
    label: "Các ý chính",
    description: "Những ý bắt buộc phải xuất hiện trong kịch bản.",
    type: "multiline",
    required: true,
    defaultValue: "- Định nghĩa\n- Nguyên nhân\n- Ví dụ thực tế\n- Sự thật thú vị",
    options: [],
  },
]

function createInitialDraft(mode: AuthoringMode, template?: TemplateRecord): TemplateDraft {
  if (mode === "edit" && template) {
    const currentVersion = getCurrentVersion(template)
    return {
      name: template.name,
      purpose: template.purpose,
      description: template.description,
      status: template.status,
      content: currentVersion.content,
      variables: cloneVariables(currentVersion.variables),
      changeNote: "",
    }
  }

  return {
    name: "Kịch bản YouTube mới",
    purpose: "script",
    description: "Tạo kịch bản chi tiết cho video YouTube với cấu trúc rõ ràng và nhất quán.",
    status: "experimental",
    content: defaultPrompt,
    variables: cloneVariables(defaultVariables),
    changeNote: "",
  }
}

function draftFingerprint(draft: TemplateDraft) {
  return JSON.stringify(draft)
}

function versionFingerprint(draft: Pick<TemplateDraft, "content" | "variables">) {
  return JSON.stringify({ content: draft.content, variables: draft.variables })
}

function metadataFingerprint(draft: Pick<TemplateDraft, "name" | "purpose" | "description" | "status">) {
  return JSON.stringify({
    name: draft.name,
    purpose: draft.purpose,
    description: draft.description,
    status: draft.status,
  })
}

function parseOptions(value: string) {
  return value
    .split(",")
    .map((option) => option.trim())
}

function getSourceValidation(draft: TemplateDraft) {
  const errors: FieldErrors = {}
  const warnings: string[] = []

  const trimmedName = draft.name.trim()
  const trimmedDescription = draft.description.trim()
  if (trimmedName.length < 3) errors.name = "Tên template cần ít nhất 3 ký tự."
  if (trimmedName.length > 80) errors.name = "Tên template không được vượt quá 80 ký tự."
  if (trimmedDescription.length < 10) errors.description = "Mô tả cần ít nhất 10 ký tự."
  if (trimmedDescription.length > 240) errors.description = "Mô tả không được vượt quá 240 ký tự."
  if (!draft.content.trim()) errors.content = "Nội dung prompt không được để trống."
  if (draft.content.length > 20_000) errors.content = "Nội dung prompt không được vượt quá 20.000 ký tự."

  const seenNames = new Set<string>()
  for (const variable of draft.variables) {
    const prefix = `variable.${variable.id}`
    if (!/^[a-z][a-z0-9_]*$/.test(variable.name)) {
      errors[`${prefix}.name`] = "Dùng lowercase snake_case, bắt đầu bằng chữ cái."
    } else if (seenNames.has(variable.name)) {
      errors[`${prefix}.name`] = "Tên biến đang bị trùng."
    }
    seenNames.add(variable.name)

    if (!variable.label.trim()) errors[`${prefix}.label`] = "Cần có nhãn hiển thị."
    if (!variable.description.trim()) errors[`${prefix}.description`] = "Cần mô tả ngắn cho biến."
    if (variable.type === "select") {
      const uniqueOptions = new Set(variable.options.map((option) => option.trim()).filter(Boolean))
      if (uniqueOptions.size === 0) errors[`${prefix}.options`] = "Biến select cần ít nhất một tùy chọn."
      if (variable.options.some((option) => !option.trim())) {
        errors[`${prefix}.options`] = "Tùy chọn không được để trống."
      }
      if (uniqueOptions.size !== variable.options.filter((option) => option.trim()).length) {
        errors[`${prefix}.options`] = "Các tùy chọn không được trùng nhau."
      }
    }
  }

  const tokenPattern = /{{\s*([^{}]*?)\s*}}/g
  const tokens = [...draft.content.matchAll(tokenPattern)]
  const tokenNames = new Set(tokens.map((match) => match[1] ?? ""))
  const contentWithoutTokens = draft.content.replace(tokenPattern, "")
  if (contentWithoutTokens.includes("{{") || contentWithoutTokens.includes("}}")) {
    errors.content = "Có placeholder chưa đóng hoặc sai cú pháp."
  }

  for (const tokenName of tokenNames) {
    if (!/^[a-z][a-z0-9_]*$/.test(tokenName)) {
      errors.content = `Placeholder {{${tokenName}}} không đúng lowercase snake_case.`
    } else if (!draft.variables.some((variable) => variable.name === tokenName)) {
      errors.content = `Placeholder {{${tokenName}}} chưa được khai báo.`
    }
  }

  for (const variable of draft.variables) {
    if (variable.name && !tokenNames.has(variable.name)) {
      warnings.push(`{{${variable.name}}} đã khai báo nhưng chưa được dùng trong prompt.`)
    }
  }

  return { errors, warnings }
}

function getPreviewErrors(variables: TemplateVariableDefinition[], values: Record<string, string>) {
  const errors: FieldErrors = {}
  for (const variable of variables) {
    const value = values[variable.id] ?? ""
    if (variable.required && !value.trim()) {
      errors[variable.id] = "Cần nhập giá trị để render."
    } else if (variable.type === "number" && value.trim() && !Number.isFinite(Number(value))) {
      errors[variable.id] = "Giá trị phải là một số."
    } else if (variable.type === "select" && value && !variable.options.includes(value)) {
      errors[variable.id] = "Giá trị không nằm trong danh sách tùy chọn."
    }
  }
  return errors
}

function renderPrompt(content: string, variables: TemplateVariableDefinition[], values: Record<string, string>) {
  const byName = new Map(variables.map((variable) => [variable.name, values[variable.id] ?? ""]))
  return content.replace(/{{\s*([a-z][a-z0-9_]*)\s*}}/g, (_, name: string) => byName.get(name) ?? "")
}

function slugify(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return normalized || "template-moi"
}

function TemplateAuthoringPage({
  mode,
  template,
  templates,
  initialDemoState = "ready",
  onCancel,
  onSave,
}: {
  mode: AuthoringMode
  template?: TemplateRecord
  templates: TemplateRecord[]
  initialDemoState?: DemoState
  onCancel: () => void
  onSave: (template: TemplateRecord, message: string) => void
}) {
  const initialDraftRef = useRef(createInitialDraft(mode, template))
  const [draft, setDraft] = useState<TemplateDraft>(() => initialDraftRef.current)
  const [step, setStep] = useState<AuthoringStep>(() => {
    const value = Number(new URLSearchParams(window.location.search).get("authorStep"))
    return value === 1 || value === 2 || value === 3 ? value : mode === "edit" ? 2 : 1
  })
  const [railView, setRailView] = useState<RailView>(() =>
    new URLSearchParams(window.location.search).get("authorRail") === "history" && mode === "edit"
      ? "history"
      : "preview",
  )
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialDraftRef.current.variables.map((variable) => [variable.id, variable.defaultValue])),
  )
  const [validationVisible, setValidationVisible] = useState(false)
  const [actionError, setActionError] = useState("")
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")
  const [leaveIntent, setLeaveIntent] = useState<LeaveIntent | null>(null)
  const [restoreVersion, setRestoreVersion] = useState<TemplateVersion | null>(null)
  const [removedVariable, setRemovedVariable] = useState<{
    variable: TemplateVariableDefinition
    index: number
  } | null>(null)
  const [demoState, setDemoState] = useState(initialDemoState)
  const sectionRefs = {
    1: useRef<HTMLElement>(null),
    2: useRef<HTMLElement>(null),
    3: useRef<HTMLElement>(null),
  }

  const sourceValidation = useMemo(() => getSourceValidation(draft), [draft])
  const previewErrors = useMemo(
    () => getPreviewErrors(draft.variables, previewValues),
    [draft.variables, previewValues],
  )
  const currentVersion = template ? getCurrentVersion(template) : undefined
  const versionChanged = currentVersion
    ? versionFingerprint(draft) !== versionFingerprint(currentVersion)
    : true
  const metadataChanged = template
    ? metadataFingerprint(draft) !== metadataFingerprint(template)
    : true
  const isDirty = draftFingerprint(draft) !== draftFingerprint(initialDraftRef.current)
  const nextVersion = currentVersion ? getNextVersion(currentVersion.version) : "v1.0"
  const completionErrors: FieldErrors = { ...sourceValidation.errors }
  const normalizedName = draft.name.trim().toLocaleLowerCase("vi")
  if (
    templates.some(
      (item) => item.id !== template?.id && item.name.trim().toLocaleLowerCase("vi") === normalizedName,
    )
  ) {
    completionErrors.name = "Đã có template khác dùng tên này."
  }
  if (mode === "edit" && versionChanged && draft.changeNote.trim().length < 3) {
    completionErrors.changeNote = "Ghi chú phiên bản cần ít nhất 3 ký tự."
  }
  if (draft.changeNote.length > 160) completionErrors.changeNote = "Ghi chú không được vượt quá 160 ký tự."
  const promptErrors = Object.fromEntries(
    Object.entries(sourceValidation.errors).filter(([key]) => key !== "name" && key !== "description"),
  )
  const promptIsValid = Object.keys(promptErrors).length === 0
  const renderedPrompt =
    promptIsValid && Object.keys(previewErrors).length === 0
      ? renderPrompt(draft.content, draft.variables, previewValues)
      : ""

  useEffect(() => {
    setPreviewValues((current) =>
      Object.fromEntries(
        draft.variables.map((variable) => [
          variable.id,
          current[variable.id] === undefined ? variable.defaultValue : current[variable.id],
        ]),
      ),
    )
  }, [draft.variables])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("authorStep", String(step))
    railView === "history"
      ? url.searchParams.set("authorRail", railView)
      : url.searchParams.delete("authorRail")
    window.history.replaceState(null, "", url)
  }, [railView, step])

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const handleAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]')
      if (!anchor) return
      if (anchor.getAttribute("href") === "#main-content") return
      event.preventDefault()
      setLeaveIntent({ kind: "anchor", href: anchor.getAttribute("href") ?? "#templates" })
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleAnchorClick, true)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleAnchorClick, true)
    }
  }, [isDirty])

  function updateDraft<K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setActionError("")
  }

  function updateVariable(id: string, patch: Partial<TemplateVariableDefinition>) {
    updateDraft(
      "variables",
      draft.variables.map((variable) => (variable.id === id ? { ...variable, ...patch } : variable)),
    )
  }

  function addVariable() {
    const id = `variable-${crypto.randomUUID()}`
    updateDraft("variables", [
      ...draft.variables,
      {
        id,
        name: "",
        label: "",
        description: "",
        type: "text",
        required: true,
        defaultValue: "",
        options: [],
      },
    ])
    setRemovedVariable(null)
    setValidationVisible(true)
    window.setTimeout(() => document.getElementById(`${id}-name`)?.focus(), 0)
  }

  function removeVariable(id: string) {
    const index = draft.variables.findIndex((variable) => variable.id === id)
    const variable = draft.variables[index]
    if (!variable) return
    setRemovedVariable({ variable, index })
    updateDraft(
      "variables",
      draft.variables.filter((variable) => variable.id !== id),
    )
  }

  function undoRemoveVariable() {
    if (!removedVariable) return
    const variables = [...draft.variables]
    variables.splice(removedVariable.index, 0, removedVariable.variable)
    updateDraft("variables", variables)
    setRemovedVariable(null)
  }

  function showStep(nextStep: AuthoringStep) {
    setStep(nextStep)
    sectionRefs[nextStep].current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    })
  }

  function focusFirstError(errors: FieldErrors) {
    const firstKey = Object.keys(errors)[0]
    if (!firstKey) return
    const targetId = firstKey.startsWith("variable.")
      ? `${firstKey.split(".")[1]}-${firstKey.split(".")[2]}`
      : `template-${firstKey}`
    window.setTimeout(() => document.getElementById(targetId)?.focus(), 0)
  }

  function nextStepAction() {
    if (step === 1) {
      const metadataErrors = Object.fromEntries(
        Object.entries(completionErrors).filter(([key]) => key === "name" || key === "description"),
      )
      if (Object.keys(metadataErrors).length) {
        setValidationVisible(true)
        focusFirstError(metadataErrors)
        return
      }
      showStep(2)
      return
    }
    if (step === 2) {
      if (Object.keys(promptErrors).length) {
        setValidationVisible(true)
        focusFirstError(promptErrors)
        return
      }
      showStep(3)
      return
    }
    saveTemplate()
  }

  function saveTemplate() {
    const errors = completionErrors

    if (Object.keys(errors).length) {
      setValidationVisible(true)
      const hasMetadataError = errors.name || errors.description
      showStep(hasMetadataError ? 1 : 2)
      focusFirstError(errors)
      return
    }

    if (demoState === "save-error") {
      setActionError("Không thể lưu bản nháp mô phỏng. Nội dung của bạn vẫn được giữ nguyên; hãy thử lại.")
      return
    }

    const now = new Date().toISOString()
    if (mode === "create") {
      const baseId = slugify(draft.name)
      let id = baseId
      let suffix = 2
      while (templates.some((item) => item.id === id)) {
        id = `${baseId}-${suffix}`
        suffix += 1
      }
      const created: TemplateRecord = {
        id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        purpose: draft.purpose,
        status: draft.status,
        thumbnail: thumbnailByPurpose[draft.purpose],
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: "Bạn",
        versions: [
          {
            version: "v1.0",
            content: draft.content,
            variables: cloneVariables(draft.variables),
            changeNote: "Khởi tạo template.",
            createdAt: now,
            createdBy: "Bạn",
          },
        ],
      }
      onSave(created, `Đã tạo “${created.name}” ở phiên bản v1.0.`)
      return
    }

    if (!template || (!versionChanged && !metadataChanged)) return
    const versions = versionChanged
      ? [
          {
            version: nextVersion,
            content: draft.content,
            variables: cloneVariables(draft.variables),
            changeNote: draft.changeNote.trim(),
            createdAt: now,
            createdBy: "Bạn",
          },
          ...template.versions,
        ]
      : template.versions
    const updated: TemplateRecord = {
      ...template,
      name: draft.name.trim(),
      description: draft.description.trim(),
      purpose: draft.purpose,
      status: draft.status,
      thumbnail: thumbnailByPurpose[draft.purpose],
      updatedAt: now,
      versions,
    }
    onSave(
      updated,
      versionChanged
        ? `Đã tạo ${nextVersion} cho “${updated.name}”.`
        : `Đã cập nhật thông tin “${updated.name}”.`,
    )
  }

  function requestCancel() {
    if (isDirty) setLeaveIntent({ kind: "cancel" })
    else onCancel()
  }

  function confirmLeave() {
    const intent = leaveIntent
    setLeaveIntent(null)
    onCancel()
    if (intent?.kind === "anchor" && intent.href !== "#templates") {
      window.location.hash = intent.href
    }
  }

  function applyVersion(version: TemplateVersion) {
    setDraft((current) => ({
      ...current,
      content: version.content,
      variables: cloneVariables(version.variables),
      changeNote: `Khôi phục nội dung từ ${version.version}`,
    }))
    setPreviewValues(Object.fromEntries(version.variables.map((variable) => [variable.id, variable.defaultValue])))
    setRestoreVersion(null)
    setRailView("preview")
    setStep(2)
  }

  function requestRestore(version: TemplateVersion) {
    if (isDirty) setRestoreVersion(version)
    else applyVersion(version)
  }

  async function copyRenderedPrompt() {
    if (!renderedPrompt) return
    try {
      await navigator.clipboard.writeText(renderedPrompt)
      setCopyState("copied")
      window.setTimeout(() => setCopyState("idle"), 1800)
    } catch {
      setCopyState("error")
    }
  }

  const finalActionLabel =
    mode === "create"
      ? "Tạo template"
      : !versionChanged && !metadataChanged
        ? "Đã lưu"
        : versionChanged
          ? `Tạo ${nextVersion}`
          : "Lưu thay đổi"

  if (demoState === "loading") {
    return (
      <div className="min-h-screen px-5 py-6 sm:px-7 lg:px-8">
        <AuthoringBreadcrumb onBack={onCancel} label={mode === "create" ? "Tạo template mới" : "Chỉnh sửa template"} />
        <div className="mt-6 rounded-lg border border-border bg-surface shadow-panel">
          <LoadingState />
        </div>
      </div>
    )
  }

  if (demoState === "error") {
    return (
      <div className="min-h-screen px-5 py-6 sm:px-7 lg:px-8">
        <AuthoringBreadcrumb onBack={onCancel} label={mode === "create" ? "Tạo template mới" : "Chỉnh sửa template"} />
        <div className="mt-6 rounded-lg border border-border bg-surface shadow-panel">
          <ErrorState onRetry={() => setDemoState("ready")} />
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-screen bg-background xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="min-w-0 px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
        <AuthoringBreadcrumb
          onBack={requestCancel}
          label={mode === "create" ? "Tạo template mới" : draft.name}
        />

        <header className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title tracking-[-0.025em] text-primary text-balance">
                {mode === "create" ? "Tạo template mới" : "Chỉnh sửa template"}
              </h1>
              {isDirty && <Badge variant="attention">Chưa lưu</Badge>}
              {mode === "edit" && currentVersion && <Badge variant="progress">Từ {currentVersion.version}</Badge>}
            </div>
            <p className="mt-0.5 text-sm leading-5 text-muted-foreground text-pretty">
              {mode === "create"
                ? "Tạo mẫu prompt để sử dụng cho việc tạo nội dung nhanh và nhất quán."
                : "Điều chỉnh thông tin, prompt và biến mà không ghi đè phiên bản hiện tại."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Button type="button" variant="outline" onClick={requestCancel}>
              Hủy
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={nextStepAction}
              disabled={step === 3 && mode === "edit" && !versionChanged && !metadataChanged}
            >
              {step < 3 ? "Tiếp theo" : finalActionLabel}
              {step < 3 && <ArrowRight aria-hidden="true" />}
            </Button>
          </div>
        </header>

        <AuthoringStepper step={step} onStepChange={showStep} />

        {actionError && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs leading-5 text-danger">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">{actionError}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDemoState("ready")
                setActionError("")
              }}
            >
              Thử lại
            </Button>
          </div>
        )}

        {validationVisible && Object.keys(completionErrors).length > 0 && (
          <div role="alert" tabIndex={-1} className="mt-4 rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs text-danger">
            <strong>Chưa thể hoàn tất template.</strong> Kiểm tra các trường được đánh dấu bên dưới.
          </div>
        )}

        <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[21.5rem_minmax(0,1fr)]">
          <section
            ref={sectionRefs[1]}
            aria-labelledby="template-information-title"
            className="scroll-mt-5 rounded-lg border border-border bg-surface p-4 shadow-panel"
          >
            <h2 id="template-information-title" className="text-section-title text-primary">
              Thông tin cơ bản
            </h2>
            <div className="mt-4 space-y-4">
              <Field
                label="Tên template"
                htmlFor="template-name"
                required
                error={validationVisible ? completionErrors.name : undefined}
                meta={`${draft.name.length}/80`}
              >
                <Input
                  id="template-name"
                  value={draft.name}
                  maxLength={80}
                  aria-invalid={Boolean(validationVisible && completionErrors.name)}
                  aria-describedby={completionErrors.name ? "template-name-error" : undefined}
                  onFocus={() => setStep(1)}
                  onChange={(event) => updateDraft("name", event.target.value)}
                />
              </Field>

              <Field label="Mục đích" htmlFor="template-purpose" required description={purposeDescription(draft.purpose)}>
                <Select
                  id="template-purpose"
                  label="Mục đích"
                  value={draft.purpose}
                  onFocus={() => setStep(1)}
                  onChange={(event) => updateDraft("purpose", event.target.value as Purpose)}
                >
                  {purposeOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Mô tả"
                htmlFor="template-description"
                required
                error={validationVisible ? completionErrors.description : undefined}
                meta={`${draft.description.length}/240`}
              >
                <Textarea
                  id="template-description"
                  value={draft.description}
                  maxLength={240}
                  className="min-h-28"
                  aria-invalid={Boolean(validationVisible && completionErrors.description)}
                  aria-describedby={completionErrors.description ? "template-description-error" : undefined}
                  onFocus={() => setStep(1)}
                  onChange={(event) => updateDraft("description", event.target.value)}
                />
              </Field>

              <Field
                label="Trạng thái"
                htmlFor="template-status"
                required
                description={draft.status === "experimental" ? "Template mới sẽ ở trạng thái Thử nghiệm." : undefined}
              >
                <Select
                  id="template-status"
                  label="Trạng thái"
                  value={draft.status}
                  onFocus={() => setStep(1)}
                  onChange={(event) => updateDraft("status", event.target.value as TemplateStatus)}
                >
                  {statusOptions.map(([value, presentation]) => (
                    <option key={value} value={value}>
                      {presentation.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <section
            ref={sectionRefs[2]}
            aria-labelledby="template-content-title"
            className="min-w-0 scroll-mt-5 rounded-lg border border-border bg-surface p-4 shadow-panel"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="template-content-title" className="text-section-title text-primary">
                  Nội dung prompt
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Chèn biến bằng cú pháp <code translate="no" className="font-mono text-accent-strong">{"{{variable_name}}"}</code>.
                </p>
              </div>
              <Badge variant={promptIsValid ? "success" : "danger"}>
                {promptIsValid ? "Prompt hợp lệ" : "Cần kiểm tra"}
              </Badge>
            </div>

            <PromptEditor
              value={draft.content}
              error={validationVisible ? completionErrors.content : undefined}
              onFocus={() => setStep(2)}
              onChange={(value) => updateDraft("content", value)}
            />

            {sourceValidation.warnings.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-[11px] leading-4 text-warning">
                <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span>{sourceValidation.warnings.join(" ")}</span>
              </div>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-section-title text-primary">Khai báo biến ({draft.variables.length})</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Định nghĩa input dùng khi xem trước prompt.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addVariable}>
                  <Plus aria-hidden="true" />
                  Thêm biến
                </Button>
              </div>

              <VariableEditor
                variables={draft.variables}
                errors={validationVisible ? completionErrors : {}}
                onFocus={() => setStep(2)}
                onUpdate={updateVariable}
                onRemove={removeVariable}
              />
              {removedVariable && (
                <div role="status" className="mt-2 flex items-center gap-2 rounded-md border border-info/15 bg-info-soft px-3 py-2 text-[11px] text-info">
                  <span className="min-w-0 flex-1 truncate">
                    Đã xóa biến <code translate="no" className="font-mono">{`{{${removedVariable.variable.name || "chưa_đặt_tên"}}}`}</code> khỏi bản nháp.
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={undoRemoveVariable}>
                    Hoàn tác
                  </Button>
                </div>
              )}
            </div>

            {mode === "edit" && versionChanged && (
              <div className="mt-4 border-t border-border pt-4">
                <Field
                  label={`Ghi chú cho ${nextVersion}`}
                  htmlFor="template-changeNote"
                  required
                  error={validationVisible ? completionErrors.changeNote : undefined}
                  meta={`${draft.changeNote.length}/160`}
                  description="Tóm tắt thay đổi để nhận biết phiên bản này trong lịch sử."
                >
                  <Input
                    id="template-changeNote"
                    value={draft.changeNote}
                    maxLength={160}
                    placeholder="Ví dụ: Bổ sung CTA và làm rõ cấu trúc mở đầu…"
                    aria-invalid={Boolean(validationVisible && completionErrors.changeNote)}
                    onChange={(event) => updateDraft("changeNote", event.target.value)}
                  />
                </Field>
              </div>
            )}
          </section>
        </div>

        <span ref={sectionRefs[3]} className="block scroll-mt-5" />
      </div>

      <aside className="min-w-0 border-t border-border bg-surface xl:sticky xl:top-0 xl:max-h-screen xl:min-h-screen xl:overflow-y-auto xl:overscroll-contain xl:border-l xl:border-t-0">
        <div className="border-b border-border px-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-section-title text-primary">
                {railView === "preview" ? "Xem trước prompt" : "Lịch sử phiên bản"}
              </h2>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                {railView === "preview" ? "Nhập giá trị để xem kết quả render." : "Các phiên bản trước của template này."}
              </p>
            </div>
            {mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRailView((view) => (view === "preview" ? "history" : "preview"))}
              >
                {railView === "preview" ? <History aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
                {railView === "preview" ? "Lịch sử" : "Xem trước"}
              </Button>
            )}
          </div>
          <Tabs
            items={mode === "edit" ? railTabs : railTabs.slice(0, 1)}
            value={railView}
            onValueChange={setRailView}
            ariaLabel="Công cụ template"
            panelId="authoring-rail-panel"
            className="mt-4"
          />
        </div>

        <div id="authoring-rail-panel" role="tabpanel" aria-labelledby={`authoring-rail-panel-${railView}-tab`}>
          {railView === "preview" ? (
            <PreviewPanel
              variables={draft.variables}
              values={previewValues}
              errors={previewErrors}
              renderedPrompt={renderedPrompt}
              sourceIsValid={promptIsValid}
              sourceLabel={isDirty ? "Bản nháp chưa lưu" : currentVersion?.version ?? "Bản nháp mới"}
              copyState={copyState}
              onFocus={() => setStep(3)}
              onValueChange={(id, value) => {
                setStep(3)
                setCopyState("idle")
                setPreviewValues((current) => ({ ...current, [id]: value }))
              }}
              onCopy={copyRenderedPrompt}
            />
          ) : (
            <VersionHistory versions={template?.versions ?? []} onRestore={requestRestore} />
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={leaveIntent !== null}
        onOpenChange={(open) => !open && setLeaveIntent(null)}
        title="Bạn có thay đổi chưa được lưu"
        description="Nếu rời khỏi trang này, các thay đổi trong bản nháp sẽ bị mất. Bạn có chắc chắn muốn rời đi?"
        onConfirm={confirmLeave}
      />

      <ConfirmDialog
        open={restoreVersion !== null}
        onOpenChange={(open) => !open && setRestoreVersion(null)}
        title={`Tạo draft từ ${restoreVersion?.version ?? "phiên bản cũ"}?`}
        description="Nội dung và khai báo biến chưa lưu hiện tại sẽ được thay bằng snapshot đã chọn. Phiên bản cũ không bị thay đổi."
        cancelLabel="Giữ bản nháp"
        confirmLabel="Dùng snapshot"
        onConfirm={() => restoreVersion && applyVersion(restoreVersion)}
      />
    </div>
  )
}

function AuthoringBreadcrumb({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="pl-10 lg:pl-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <button type="button" className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35" onClick={onBack}>
            Templates
          </button>
        </li>
        <li aria-hidden="true" className="text-border-strong">/</li>
        <li aria-current="page" className="truncate font-semibold text-primary">{label}</li>
      </ol>
    </nav>
  )
}

function AuthoringStepper({ step, onStepChange }: { step: AuthoringStep; onStepChange: (step: AuthoringStep) => void }) {
  const items: Array<{ step: AuthoringStep; label: string; description: string }> = [
    { step: 1, label: "Thông tin", description: "Tên, mục đích, mô tả" },
    { step: 2, label: "Nội dung & biến", description: "Prompt và khai báo biến" },
    { step: 3, label: "Xem trước", description: "Kiểm tra và hoàn thiện" },
  ]

  return (
    <ol aria-label="Các bước tạo template" className="mt-6 grid gap-3 sm:grid-cols-3">
      {items.map((item, index) => {
        const active = item.step === step
        const complete = item.step < step
        return (
          <li key={item.step} className="relative min-w-0">
            {index < items.length - 1 && (
              <span aria-hidden="true" className="absolute left-9 right-[-0.75rem] top-4 hidden h-px bg-border sm:block" />
            )}
            <button
              type="button"
              aria-current={active ? "step" : undefined}
              className="relative flex w-full items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              onClick={() => onStepChange(item.step)}
            >
              <span
                className={cn(
                  "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  active
                    ? "border-accent bg-accent text-accent-foreground"
                    : complete
                      ? "border-info bg-info text-white"
                      : "border-border bg-muted text-muted-foreground",
                )}
              >
                {complete ? <Check aria-hidden="true" className="size-4" /> : item.step}
              </span>
              <span className="min-w-0 pt-0.5">
                <span className={cn("block text-xs font-bold", active ? "text-accent-strong" : "text-primary")}>{item.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{item.description}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function PromptEditor({
  value,
  error,
  onFocus,
  onChange,
}: {
  value: string
  error?: string
  onFocus: () => void
  onChange: (value: string) => void
}) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineCount = Math.max(1, value.split("\n").length)

  return (
    <div className="mt-3">
      <label htmlFor="template-content" className="sr-only">Nội dung prompt</label>
      <div className={cn("grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] overflow-hidden rounded-md border bg-muted/25", error ? "border-danger/45" : "border-input")}>
        <div ref={gutterRef} aria-hidden="true" className="max-h-80 overflow-hidden border-r border-border bg-muted/50 py-2 font-mono text-[11px] leading-5 text-muted-foreground/65">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index} className="block pr-2 text-right tabular-nums">{index + 1}</span>
          ))}
        </div>
        <Textarea
          id="template-content"
          translate="no"
          value={value}
          wrap="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "template-content-error" : undefined}
          className="min-h-80 max-h-80 resize-none rounded-none border-0 bg-surface px-3 py-2 font-mono text-xs leading-5 shadow-none focus:ring-0"
          onFocus={onFocus}
          onScroll={(event) => {
            if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
          }}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        {error ? <p id="template-content-error" role="alert" className="text-[11px] leading-4 text-danger">{error}</p> : <span />}
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{value.length.toLocaleString("vi-VN")}/20.000</span>
      </div>
    </div>
  )
}

function VariableEditor({
  variables,
  errors,
  onFocus,
  onUpdate,
  onRemove,
}: {
  variables: TemplateVariableDefinition[]
  errors: FieldErrors
  onFocus: () => void
  onUpdate: (id: string, patch: Partial<TemplateVariableDefinition>) => void
  onRemove: (id: string) => void
}) {
  if (variables.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-border-strong px-4 py-6 text-center">
        <p className="text-xs font-semibold text-primary">Prompt chưa có biến</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Thêm biến nếu prompt cần dữ liệu đầu vào khi render.</p>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {variables.map((variable) => {
        const prefix = `variable.${variable.id}`
        return (
          <div key={variable.id} className="rounded-md border border-border bg-muted/18 p-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-[1rem_minmax(7rem,1fr)_minmax(8rem,1.2fr)_7rem_4.5rem_2rem] sm:items-start">
              <GripVertical aria-hidden="true" className="mt-2.5 hidden size-3.5 text-muted-foreground/60 sm:block" />
              <div>
                <label htmlFor={`${variable.id}-name`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">Tên biến</label>
                <Input
                  id={`${variable.id}-name`}
                  value={variable.name}
                  aria-label="Tên biến"
                  aria-invalid={Boolean(errors[`${prefix}.name`])}
                  className="h-8 font-mono text-xs text-accent-strong"
                  placeholder="Ví dụ: variable_name…"
                  translate="no"
                  onFocus={onFocus}
                  onChange={(event) => onUpdate(variable.id, { name: event.target.value })}
                />
                {errors[`${prefix}.name`] && <p className="mt-1 text-[10px] leading-3 text-danger">{errors[`${prefix}.name`]}</p>}
              </div>
              <div>
                <label htmlFor={`${variable.id}-label`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">Nhãn hiển thị</label>
                <Input
                  id={`${variable.id}-label`}
                  value={variable.label}
                  aria-label="Nhãn hiển thị"
                  aria-invalid={Boolean(errors[`${prefix}.label`])}
                  className="h-8 text-xs"
                  placeholder="Nhãn hiển thị…"
                  onFocus={onFocus}
                  onChange={(event) => onUpdate(variable.id, { label: event.target.value })}
                />
              </div>
              <Select
                id={`${variable.id}-type`}
                label="Kiểu dữ liệu"
                value={variable.type}
                className="h-8 text-xs"
                onFocus={onFocus}
                onChange={(event) => {
                  const type = event.target.value as VariableType
                  const nextOptions = type === "select" && variable.options.length === 0 ? ["Tùy chọn 1"] : variable.options
                  onUpdate(variable.id, {
                    type,
                    options: type === "select" ? nextOptions : [],
                    defaultValue:
                      type === "select" && !nextOptions.includes(variable.defaultValue)
                        ? (nextOptions[0] ?? "")
                        : variable.defaultValue,
                  })
                }}
              >
                <option value="text">text</option>
                <option value="multiline">multiline</option>
                <option value="number">number</option>
                <option value="select">select</option>
              </Select>
              <button
                type="button"
                role="switch"
                aria-checked={variable.required}
                aria-label={`${variable.label || variable.name || "Biến"}: bắt buộc`}
                className="mt-1 inline-flex h-6 w-11 items-center rounded-full bg-border-strong p-0.5 transition-colors hover:bg-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 data-[checked=true]:bg-success data-[checked=true]:hover:bg-success/90"
                data-checked={variable.required}
                onClick={() => onUpdate(variable.id, { required: !variable.required })}
              >
                <span className={cn("size-5 rounded-full bg-white shadow-sm transition-transform", variable.required && "translate-x-5")} />
              </button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Xóa biến ${variable.name || "chưa đặt tên"}`} onClick={() => onRemove(variable.id)}>
                <Trash2 aria-hidden="true" className="text-danger" />
              </Button>
            </div>

            <div className={cn("mt-2 grid gap-2", variable.type === "select" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              <div>
                <label htmlFor={`${variable.id}-description`} className="sr-only">Mô tả biến</label>
                <Input
                  id={`${variable.id}-description`}
                  value={variable.description}
                  aria-label="Mô tả biến"
                  aria-invalid={Boolean(errors[`${prefix}.description`])}
                  className="h-8 text-xs"
                  placeholder="Mô tả ngắn…"
                  onFocus={onFocus}
                  onChange={(event) => onUpdate(variable.id, { description: event.target.value })}
                />
              </div>
              {variable.type === "select" ? (
                <>
                  <div>
                    <label htmlFor={`${variable.id}-options`} className="sr-only">Các tùy chọn</label>
                    <Input
                      id={`${variable.id}-options`}
                      value={variable.options.join(", ")}
                      aria-label="Các tùy chọn, phân tách bằng dấu phẩy"
                      aria-invalid={Boolean(errors[`${prefix}.options`])}
                      className="h-8 text-xs"
                      placeholder="Ví dụ: Hài hước, Nghiêm túc…"
                      onFocus={onFocus}
                      onChange={(event) => {
                        const options = parseOptions(event.target.value)
                        onUpdate(variable.id, {
                          options,
                          defaultValue: options.includes(variable.defaultValue) ? variable.defaultValue : (options[0] ?? ""),
                        })
                      }}
                    />
                  </div>
                  <Select
                    id={`${variable.id}-default`}
                    label="Giá trị mặc định"
                    value={variable.defaultValue}
                    className="h-8 text-xs"
                    onFocus={onFocus}
                    onChange={(event) => onUpdate(variable.id, { defaultValue: event.target.value })}
                  >
                    <option value="">Không có mặc định</option>
                    {variable.options.filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}
                  </Select>
                </>
              ) : (
                <div>
                  <label htmlFor={`${variable.id}-default`} className="sr-only">Giá trị mặc định</label>
                  {variable.type === "multiline" ? (
                    <Textarea
                      id={`${variable.id}-default`}
                      value={variable.defaultValue}
                      aria-label="Giá trị mặc định"
                      className="min-h-16 text-xs"
                      placeholder="Giá trị mặc định…"
                      onFocus={onFocus}
                      onChange={(event) => onUpdate(variable.id, { defaultValue: event.target.value })}
                    />
                  ) : (
                    <Input
                      id={`${variable.id}-default`}
                      type={variable.type === "number" ? "number" : "text"}
                      value={variable.defaultValue}
                      aria-label="Giá trị mặc định"
                      className="h-8 text-xs"
                      placeholder="Giá trị mặc định…"
                      onFocus={onFocus}
                      onChange={(event) => onUpdate(variable.id, { defaultValue: event.target.value })}
                    />
                  )}
                </div>
              )}
            </div>
            {(errors[`${prefix}.label`] || errors[`${prefix}.description`] || errors[`${prefix}.options`]) && (
              <p className="mt-1.5 text-[10px] leading-3 text-danger">
                {errors[`${prefix}.label`] || errors[`${prefix}.description`] || errors[`${prefix}.options`]}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PreviewPanel({
  variables,
  values,
  errors,
  renderedPrompt,
  sourceIsValid,
  sourceLabel,
  copyState,
  onFocus,
  onValueChange,
  onCopy,
}: {
  variables: TemplateVariableDefinition[]
  values: Record<string, string>
  errors: FieldErrors
  renderedPrompt: string
  sourceIsValid: boolean
  sourceLabel: string
  copyState: "idle" | "copied" | "error"
  onFocus: () => void
  onValueChange: (id: string, value: string) => void
  onCopy: () => void
}) {
  return (
    <div className="px-5 py-4">
      <div className="space-y-3.5">
        {variables.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-strong px-4 py-5 text-center text-xs text-muted-foreground">
            Prompt không cần dữ liệu đầu vào.
          </div>
        ) : (
          variables.map((variable) => (
            <Field
              key={variable.id}
              label={variable.label || variable.name || "Biến chưa đặt tên"}
              htmlFor={`preview-${variable.id}`}
              required={variable.required}
              error={errors[variable.id]}
            >
              {variable.type === "multiline" ? (
                <Textarea
                  id={`preview-${variable.id}`}
                  value={values[variable.id] ?? ""}
                  className="min-h-20 text-xs"
                  aria-invalid={Boolean(errors[variable.id])}
                  onFocus={onFocus}
                  onChange={(event) => onValueChange(variable.id, event.target.value)}
                />
              ) : variable.type === "select" ? (
                <Select
                  id={`preview-${variable.id}`}
                  label={variable.label || variable.name}
                  value={values[variable.id] ?? ""}
                  aria-invalid={Boolean(errors[variable.id])}
                  onFocus={onFocus}
                  onChange={(event) => onValueChange(variable.id, event.target.value)}
                >
                  {!variable.required && <option value="">Không chọn</option>}
                  {variable.options.filter(Boolean).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={`preview-${variable.id}`}
                  type={variable.type === "number" ? "number" : "text"}
                  value={values[variable.id] ?? ""}
                  aria-invalid={Boolean(errors[variable.id])}
                  onFocus={onFocus}
                  onChange={(event) => onValueChange(variable.id, event.target.value)}
                />
              )}
            </Field>
          ))
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <span className="sr-only" aria-live="polite">
          {copyState === "copied" ? "Đã sao chép prompt đã render." : copyState === "error" ? "Không thể sao chép prompt." : ""}
        </span>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-section-title text-primary">Kết quả render</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{sourceLabel}</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={!renderedPrompt} onClick={onCopy}>
            {copyState === "copied" ? <CheckCircle2 aria-hidden="true" className="text-success" /> : <Clipboard aria-hidden="true" />}
            {copyState === "copied" ? "Đã sao chép" : "Sao chép"}
          </Button>
        </div>

        {copyState === "error" && (
          <p role="alert" className="mt-2 text-[11px] text-danger">Không thể truy cập clipboard. Hãy thử lại.</p>
        )}

        {renderedPrompt ? (
          <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/50 p-3 font-sans text-xs leading-5 text-foreground">
            {renderedPrompt}
          </pre>
        ) : (
          <div className="mt-3 rounded-md border border-dashed border-border-strong px-4 py-7 text-center">
            <CircleAlert aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-xs font-semibold text-primary">
              {sourceIsValid ? "Chưa đủ dữ liệu để render" : "Prompt cần được sửa trước khi render"}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              {sourceIsValid ? "Điền các giá trị bắt buộc ở phía trên." : "Kiểm tra nội dung prompt và khai báo biến."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function VersionHistory({ versions, onRestore }: { versions: TemplateVersion[]; onRestore: (version: TemplateVersion) => void }) {
  return (
    <div className="px-5 py-4">
      <ol className="space-y-3">
        {versions.map((version, index) => (
          <li key={version.version} className="rounded-md border border-border p-3">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className={cn("mt-1 size-2 shrink-0 rounded-full", index === 0 ? "bg-success" : "bg-border-strong")} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-xs text-primary">{version.version}</strong>
                  {index === 0 && <Badge variant="info">Hiện tại</Badge>}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground text-pretty">{version.changeNote}</p>
                <p className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">{formatDateTime(version.createdAt)} · {version.createdBy}</p>
                {index > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => onRestore(version)}>
                    <RotateCcw aria-hidden="true" />
                    Tạo draft từ bản này
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function purposeDescription(purpose: Purpose) {
  const descriptions: Record<Purpose, string> = {
    script: "Tạo kịch bản chi tiết cho video.",
    thumbnail: "Phát triển concept và prompt thumbnail.",
    hook: "Tạo hook mở đầu cho nội dung.",
    description: "Soạn mô tả và metadata cho video.",
    idea: "Khám phá và phát triển ý tưởng nội dung.",
    other: "Mục đích tùy chỉnh khác.",
  }
  return descriptions[purpose]
}

function formatDateTime(value: string) {
  const date = new Date(value)
  const datePart = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date)
  const timePart = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date)
  return `${datePart} ${timePart}`
}

export { TemplateAuthoringPage }
export type { AuthoringMode }
