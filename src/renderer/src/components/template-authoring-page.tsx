import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clipboard,
  FileText,
  GripVertical,
  Info,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type AuthoringMode = "create" | "edit"
type AuthoringStep = 1 | 2
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
    required: false,
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
  return value.split(",").map((option) => option.trim())
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
    if (variable.type === "select") {
      const cleanOptions = variable.options.map((option) => option.trim()).filter(Boolean)
      const uniqueOptions = new Set(cleanOptions)
      if (uniqueOptions.size === 0) errors[`${prefix}.options`] = "Biến chọn một cần ít nhất một tùy chọn."
      if (variable.options.some((option) => !option.trim())) {
        errors[`${prefix}.options`] = "Tùy chọn không được để trống."
      }
      if (uniqueOptions.size !== cleanOptions.length) {
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
  const [step, setStep] = useState<AuthoringStep>(() =>
    new URLSearchParams(window.location.search).get("authorStep") === "2" ? 2 : 1,
  )
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialDraftRef.current.variables.map((variable) => [variable.id, variable.defaultValue])),
  )
  const [validationVisible, setValidationVisible] = useState(false)
  const [actionError, setActionError] = useState("")
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")
  const [leaveIntent, setLeaveIntent] = useState<LeaveIntent | null>(null)
  const [removedVariable, setRemovedVariable] = useState<{
    variable: TemplateVariableDefinition
    index: number
  } | null>(null)
  const [expandedVariableId, setExpandedVariableId] = useState<string | null>(() =>
    initialDraftRef.current.variables[1]?.id ?? initialDraftRef.current.variables[0]?.id ?? null,
  )
  const [demoState, setDemoState] = useState(initialDemoState)

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
  const hasUnsavedChanges = mode === "create" || isDirty
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

  const promptIsValid = Object.keys(sourceValidation.errors).every(
    (key) => key === "name" || key === "description",
  )
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
    url.searchParams.delete("authorRail")
    window.history.replaceState(null, "", url)
  }, [step])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const handleAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]')
      if (!anchor || anchor.getAttribute("href") === "#main-content") return
      event.preventDefault()
      setLeaveIntent({ kind: "anchor", href: anchor.getAttribute("href") ?? "#templates" })
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleAnchorClick, true)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleAnchorClick, true)
    }
  }, [hasUnsavedChanges])

  function updateDraft<K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setActionError("")
  }

  function updateVariable(id: string, patch: Partial<TemplateVariableDefinition>) {
    updateDraft("variables", draft.variables.map((variable) => variable.id === id ? { ...variable, ...patch } : variable))
  }

  function addVariable() {
    const id = `variable-${crypto.randomUUID()}`
    updateDraft("variables", [
      ...draft.variables,
      {
        id,
        name: "",
        label: "",
        description: "Biến dùng để render prompt.",
        type: "text",
        required: true,
        defaultValue: "",
        options: [],
      },
    ])
    setRemovedVariable(null)
    setExpandedVariableId(id)
    window.setTimeout(() => document.getElementById(`${id}-name`)?.focus(), 0)
  }

  function removeVariable(id: string) {
    const index = draft.variables.findIndex((variable) => variable.id === id)
    const variable = draft.variables[index]
    if (!variable) return
    setRemovedVariable({ variable, index })
    if (expandedVariableId === id) setExpandedVariableId(null)
    updateDraft("variables", draft.variables.filter((item) => item.id !== id))
  }

  function undoRemoveVariable() {
    if (!removedVariable) return
    const variables = [...draft.variables]
    variables.splice(removedVariable.index, 0, removedVariable.variable)
    updateDraft("variables", variables)
    setExpandedVariableId(removedVariable.variable.id)
    setRemovedVariable(null)
  }

  function focusFirstError(errors: FieldErrors, prefix = "template-") {
    const firstKey = Object.keys(errors)[0]
    if (!firstKey) return
    const targetId = firstKey.startsWith("variable.")
      ? `${firstKey.split(".")[1]}-${firstKey.split(".")[2]}`
      : `${prefix}${firstKey}`
    window.setTimeout(() => document.getElementById(targetId)?.focus(), 0)
  }

  function goToStep(nextStep: AuthoringStep) {
    if (nextStep === 2 && Object.keys(completionErrors).length > 0) {
      setValidationVisible(true)
      const firstVariableError = Object.keys(completionErrors).find((key) => key.startsWith("variable."))
      if (firstVariableError) setExpandedVariableId(firstVariableError.split(".")[1] ?? null)
      focusFirstError(completionErrors)
      return
    }
    setStep(nextStep)
    setValidationVisible(false)
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
  }

  function saveTemplate() {
    if (Object.keys(completionErrors).length > 0) {
      setValidationVisible(true)
      setStep(1)
      focusFirstError(completionErrors)
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
        versions: [{
          version: "v1.0",
          content: draft.content,
          variables: cloneVariables(draft.variables),
          changeNote: "Khởi tạo template.",
          createdAt: now,
          createdBy: "Bạn",
        }],
      }
      onSave(created, `Đã tạo “${created.name}” ở phiên bản v1.0.`)
      return
    }

    if (!template || (!versionChanged && !metadataChanged)) return
    const versions = versionChanged
      ? [{
          version: nextVersion,
          content: draft.content,
          variables: cloneVariables(draft.variables),
          changeNote: draft.changeNote.trim(),
          createdAt: now,
          createdBy: "Bạn",
        }, ...template.versions]
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
    onSave(updated, versionChanged ? `Đã tạo ${nextVersion} cho “${updated.name}”.` : `Đã cập nhật thông tin “${updated.name}”.`)
  }

  function requestCancel() {
    if (hasUnsavedChanges) setLeaveIntent({ kind: "cancel" })
    else onCancel()
  }

  function confirmLeave() {
    const intent = leaveIntent
    setLeaveIntent(null)
    onCancel()
    if (intent?.kind === "anchor" && intent.href !== "#templates") window.location.hash = intent.href
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

  if (demoState === "loading") {
    return (
      <div className="min-h-screen px-5 py-6 sm:px-7 lg:px-8">
        <AuthoringBreadcrumb onBack={onCancel} label={mode === "create" ? "Tạo template mới" : "Chỉnh sửa template"} />
        <div className="mt-6 rounded-lg border border-border bg-surface shadow-panel"><LoadingState /></div>
      </div>
    )
  }

  if (demoState === "error") {
    return (
      <div className="min-h-screen px-5 py-6 sm:px-7 lg:px-8">
        <AuthoringBreadcrumb onBack={onCancel} label={mode === "create" ? "Tạo template mới" : "Chỉnh sửa template"} />
        <div className="mt-6 rounded-lg border border-border bg-surface shadow-panel"><ErrorState onRetry={() => setDemoState("ready")} /></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className={cn("mx-auto min-w-0 px-5 py-6 sm:px-7 lg:px-8 lg:py-7", step === 1 ? "max-w-[1480px]" : "max-w-5xl")}>
        <AuthoringBreadcrumb onBack={requestCancel} label={step === 1 ? (mode === "create" ? "Tạo template mới" : draft.name) : "Xem trước & hoàn thành"} />

        <header className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title tracking-[-0.025em] text-primary text-balance">
                {step === 1 ? (mode === "create" ? "Tạo template mới" : "Chỉnh sửa template") : "Xem trước & hoàn thành"}
              </h1>
              {hasUnsavedChanges && <Badge variant="attention">Chưa lưu</Badge>}
              {mode === "edit" && currentVersion && <Badge variant="progress">Từ {currentVersion.version}</Badge>}
            </div>
            <p className="mt-0.5 max-w-2xl text-sm leading-5 text-muted-foreground text-pretty">
              {step === 1
                ? "Hoàn thiện thông tin, nội dung prompt và các biến đầu vào trước khi kiểm tra kết quả."
                : "Kiểm tra lại thông tin, nhập giá trị mẫu và đọc prompt đã render trước khi lưu."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {step === 1 ? (
              <>
                <Button type="button" variant="outline" onClick={requestCancel}>Hủy</Button>
                <Button type="button" variant="accent" onClick={() => goToStep(2)}>Tiếp tục<ArrowRight aria-hidden="true" /></Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => goToStep(1)}>Quay lại</Button>
                <Button type="button" variant="accent" disabled={mode === "edit" && !versionChanged && !metadataChanged} onClick={saveTemplate}>Hoàn thành</Button>
              </>
            )}
          </div>
        </header>

        <AuthoringStepper step={step} onStepChange={goToStep} />

        {actionError && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs leading-5 text-danger">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">{actionError}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setDemoState("ready"); setActionError("") }}>Thử lại</Button>
          </div>
        )}

        {step === 1 ? (
          <EditStep
            mode={mode}
            draft={draft}
            errors={validationVisible ? completionErrors : {}}
            warnings={sourceValidation.warnings}
            promptIsValid={promptIsValid}
            nextVersion={nextVersion}
            versionChanged={versionChanged}
            removedVariable={removedVariable}
            expandedVariableId={expandedVariableId}
            onUpdateDraft={updateDraft}
            onUpdateVariable={updateVariable}
            onAddVariable={addVariable}
            onRemoveVariable={removeVariable}
            onUndoRemoveVariable={undoRemoveVariable}
            onExpandedVariableChange={setExpandedVariableId}
            onValidate={() => setValidationVisible(true)}
          />
        ) : (
          <ReviewStep
            draft={draft}
            values={previewValues}
            errors={previewErrors}
            renderedPrompt={renderedPrompt}
            copyState={copyState}
            mode={mode}
            nextVersion={nextVersion}
            versionChanged={versionChanged}
            onEdit={() => goToStep(1)}
            onValueChange={(id, value) => {
              setCopyState("idle")
              setPreviewValues((current) => ({ ...current, [id]: value }))
            }}
            onCopy={copyRenderedPrompt}
          />
        )}
      </div>

      <ConfirmDialog
        open={leaveIntent !== null}
        onOpenChange={(open) => !open && setLeaveIntent(null)}
        title="Bạn có thay đổi chưa được lưu"
        description="Nếu rời khỏi trang này, các thay đổi trong bản nháp sẽ bị mất. Bạn có chắc chắn muốn rời đi?"
        cancelLabel="Ở lại"
        confirmLabel="Rời đi"
        onConfirm={confirmLeave}
      />
    </div>
  )
}

function EditStep({
  mode,
  draft,
  errors,
  warnings,
  promptIsValid,
  nextVersion,
  versionChanged,
  removedVariable,
  expandedVariableId,
  onUpdateDraft,
  onUpdateVariable,
  onAddVariable,
  onRemoveVariable,
  onUndoRemoveVariable,
  onExpandedVariableChange,
  onValidate,
}: {
  mode: AuthoringMode
  draft: TemplateDraft
  errors: FieldErrors
  warnings: string[]
  promptIsValid: boolean
  nextVersion: string
  versionChanged: boolean
  removedVariable: { variable: TemplateVariableDefinition; index: number } | null
  expandedVariableId: string | null
  onUpdateDraft: <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => void
  onUpdateVariable: (id: string, patch: Partial<TemplateVariableDefinition>) => void
  onAddVariable: () => void
  onRemoveVariable: (id: string) => void
  onUndoRemoveVariable: () => void
  onExpandedVariableChange: (id: string | null) => void
  onValidate: () => void
}) {
  const hasErrors = Object.keys(errors).length > 0

  return (
    <>
      {hasErrors && (
        <div role="alert" tabIndex={-1} className="mt-4 rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs text-danger">
          <strong>Chưa thể tiếp tục.</strong> Kiểm tra các trường được đánh dấu bên dưới.
        </div>
      )}
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
        <section aria-labelledby="template-information-title" className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          <div className="flex items-center gap-2">
            <FileText aria-hidden="true" className="size-4 text-info" />
            <h2 id="template-information-title" className="text-section-title text-primary">Thông tin cơ bản</h2>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            Thông tin chung giúp nhận biết và sử dụng template sau này.
          </p>
          <div className="mt-4 space-y-4">
            <Field label="Tên template" htmlFor="template-name" required error={errors.name} meta={`${draft.name.length}/80`}>
              <Input
                id="template-name"
                value={draft.name}
                maxLength={80}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "template-name-error" : undefined}
                onChange={(event) => onUpdateDraft("name", event.target.value)}
              />
            </Field>
            <Field label="Mục đích" htmlFor="template-purpose" required description={purposeDescription(draft.purpose)}>
              <Select
                id="template-purpose"
                label="Mục đích"
                value={draft.purpose}
                aria-describedby="template-purpose-description"
                onChange={(event) => onUpdateDraft("purpose", event.target.value as Purpose)}
              >
                {purposeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Mô tả" htmlFor="template-description" required error={errors.description} meta={`${draft.description.length}/240`}>
              <Textarea
                id="template-description"
                value={draft.description}
                maxLength={240}
                className="min-h-28"
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "template-description-error" : undefined}
                onChange={(event) => onUpdateDraft("description", event.target.value)}
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
                aria-describedby={draft.status === "experimental" ? "template-status-description" : undefined}
                onChange={(event) => onUpdateDraft("status", event.target.value as TemplateStatus)}
              >
                {statusOptions.map(([value, presentation]) => <option key={value} value={value}>{presentation.label}</option>)}
              </Select>
            </Field>
          </div>
        </section>

        <section aria-labelledby="template-content-title" className="min-w-0 rounded-lg border border-border bg-surface shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles aria-hidden="true" className="size-4 text-accent" />
                <h2 id="template-content-title" className="text-section-title text-primary">Nội dung prompt</h2>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                Viết prompt với các biến để dễ dàng tùy chỉnh. Dùng cú pháp <code translate="no" className="font-mono text-accent-strong">{"{{variable_name}}"}</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onValidate}>
                <Info aria-hidden="true" />
                Kiểm tra cú pháp
              </Button>
              <Badge variant={promptIsValid ? "success" : "danger"}>{promptIsValid ? "Hợp lệ" : "Cần sửa"}</Badge>
            </div>
          </div>

          <div className="border-t border-border px-4 py-3.5">
            <PromptEditor value={draft.content} error={errors.content} onChange={(value) => onUpdateDraft("content", value)} />
            {warnings.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-[11px] leading-4 text-warning">
                <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span>{warnings.join(" ")}</span>
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-section-title text-primary">Khai báo biến ({draft.variables.length})</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Chọn từng biến để chỉnh sửa chi tiết; giá trị mẫu sẽ nhập ở bước tiếp theo.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onAddVariable}>
                <Plus aria-hidden="true" />
                Thêm biến
              </Button>
            </div>
            <VariableEditor
              variables={draft.variables}
              errors={errors}
              expandedVariableId={expandedVariableId}
              onExpandedVariableChange={onExpandedVariableChange}
              onUpdate={onUpdateVariable}
              onRemove={onRemoveVariable}
            />
            {removedVariable && (
              <div role="status" className="mt-2 flex items-center gap-2 rounded-md border border-info/15 bg-info-soft px-3 py-2 text-[11px] text-info">
                <span className="min-w-0 flex-1 truncate">
                  Đã xóa biến <code translate="no" className="font-mono">{`{{${removedVariable.variable.name || "chưa_đặt_tên"}}}`}</code> khỏi bản nháp.
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={onUndoRemoveVariable}>Hoàn tác</Button>
              </div>
            )}
          </div>

          {mode === "edit" && versionChanged && (
            <div className="border-t border-border px-4 py-3.5">
              <Field
                label={`Ghi chú cho ${nextVersion}`}
                htmlFor="template-changeNote"
                required
                error={errors.changeNote}
                meta={`${draft.changeNote.length}/160`}
                description="Tóm tắt thay đổi để nhận biết phiên bản này trong lịch sử."
              >
                <Input
                  id="template-changeNote"
                  value={draft.changeNote}
                  maxLength={160}
                  placeholder="Ví dụ: Bổ sung CTA và làm rõ cấu trúc mở đầu…"
                  aria-invalid={Boolean(errors.changeNote)}
                  aria-describedby={errors.changeNote ? "template-changeNote-error" : "template-changeNote-description"}
                  onChange={(event) => onUpdateDraft("changeNote", event.target.value)}
                />
              </Field>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function ReviewStep({
  draft,
  values,
  errors,
  renderedPrompt,
  copyState,
  mode,
  nextVersion,
  versionChanged,
  onEdit,
  onValueChange,
  onCopy,
}: {
  draft: TemplateDraft
  values: Record<string, string>
  errors: FieldErrors
  renderedPrompt: string
  copyState: "idle" | "copied" | "error"
  mode: AuthoringMode
  nextVersion: string
  versionChanged: boolean
  onEdit: () => void
  onValueChange: (id: string, value: string) => void
  onCopy: () => void
}) {
  return (
    <div className="mt-4 space-y-4">
      {Object.keys(errors).length > 0 && (
        <div role="status" className="rounded-md border border-warning/20 bg-warning-soft px-3 py-2.5 text-xs text-warning">
          <strong>Preview chưa hoàn chỉnh.</strong> Nhập đủ giá trị mẫu hợp lệ để kiểm tra prompt; lỗi preview không làm thay đổi nội dung sẽ lưu.
        </div>
      )}

      <ReviewSection
        title="Tóm tắt template"
        icon={<FileText aria-hidden="true" />}
        action={<Button type="button" variant="ghost" size="sm" onClick={onEdit}><Pencil aria-hidden="true" />Chỉnh sửa</Button>}
      >
        <dl className="divide-y divide-border text-xs">
          <ReviewRow label="Tên template"><strong className="break-words text-primary">{draft.name}</strong></ReviewRow>
          <ReviewRow label="Mục đích"><Badge variant="attention">{purposeLabels[draft.purpose]}</Badge></ReviewRow>
          <ReviewRow label="Mô tả"><span className="break-words leading-5 text-foreground">{draft.description}</span></ReviewRow>
          <ReviewRow label="Trạng thái"><StatusBadge label={statusPresentation[draft.status].label} tone={statusPresentation[draft.status].tone} /></ReviewRow>
          {mode === "edit" && versionChanged && <ReviewRow label={`Phiên bản ${nextVersion}`}><span>{draft.changeNote}</span></ReviewRow>}
        </dl>
      </ReviewSection>

      <ReviewSection
        title={`Danh sách biến (${draft.variables.length})`}
        icon={<Sparkles aria-hidden="true" />}
        action={<Button type="button" variant="ghost" size="sm" onClick={onEdit}><Pencil aria-hidden="true" />Chỉnh sửa</Button>}
      >
        <ReviewVariables variables={draft.variables} values={values} errors={errors} onValueChange={onValueChange} />
      </ReviewSection>

      <ReviewSection
        title="Xem trước prompt (với giá trị mẫu)"
        icon={<Clipboard aria-hidden="true" />}
        action={
          <Button type="button" variant="outline" size="sm" disabled={!renderedPrompt} onClick={onCopy}>
            {copyState === "copied" ? <CheckCircle2 aria-hidden="true" className="text-success" /> : <Clipboard aria-hidden="true" />}
            {copyState === "copied" ? "Đã sao chép" : "Sao chép"}
          </Button>
        }
      >
        <span className="sr-only" aria-live="polite">
          {copyState === "copied" ? "Đã sao chép prompt đã render." : copyState === "error" ? "Không thể sao chép prompt." : ""}
        </span>
        {copyState === "error" && <p role="alert" className="mb-2 text-[11px] text-danger">Không thể truy cập clipboard. Hãy thử lại.</p>}
        {renderedPrompt ? (
          <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/55 p-4 font-sans text-xs leading-5 text-foreground">{renderedPrompt}</pre>
        ) : (
          <div className="rounded-md border border-dashed border-border-strong px-4 py-7 text-center">
            <CircleAlert aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-xs font-semibold text-primary">Chưa đủ dữ liệu để render</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Kiểm tra các giá trị mẫu trong danh sách biến phía trên.</p>
          </div>
        )}
      </ReviewSection>
    </div>
  )
}

function ReviewSection({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-primary [&_svg]:size-4 [&_svg]:text-info">
          {icon}
          <h2 className="text-section-title">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-4 py-2.5">{children}</div>
    </section>
  )
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function ReviewVariables({
  variables,
  values,
  errors,
  onValueChange,
}: {
  variables: TemplateVariableDefinition[]
  values: Record<string, string>
  errors: FieldErrors
  onValueChange: (id: string, value: string) => void
}) {
  if (variables.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Prompt này không cần biến đầu vào.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-2 font-semibold">Tên biến</th>
            <th className="px-2 py-2 font-semibold">Nhãn hiển thị</th>
            <th className="px-2 py-2 font-semibold">Kiểu dữ liệu</th>
            <th className="w-[19rem] px-2 py-2 font-semibold">Giá trị mẫu</th>
            <th className="px-2 py-2 text-center font-semibold">Bắt buộc</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {variables.map((variable) => (
            <tr key={variable.id} className="align-top">
              <td translate="no" className="px-2 py-2.5 font-mono text-accent-strong">{variable.name}</td>
              <td className="px-2 py-2.5 text-primary">{variable.label}</td>
              <td className="px-2 py-2.5">{variableTypeLabels[variable.type]}</td>
              <td className="px-2 py-2">
                <ReviewValueInput
                  variable={variable}
                  value={values[variable.id] ?? ""}
                  error={errors[variable.id]}
                  onChange={(value) => onValueChange(variable.id, value)}
                />
              </td>
              <td className="px-2 py-2.5 text-center font-semibold text-success">{variable.required ? "Có" : "Không"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReviewValueInput({
  variable,
  value,
  error,
  onChange,
}: {
  variable: TemplateVariableDefinition
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const id = `review-${variable.id}`
  return (
    <div>
      {variable.type === "multiline" ? (
        <Textarea
          id={id}
          value={value}
          aria-label={`Giá trị mẫu cho ${variable.label}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-16 text-xs"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : variable.type === "select" ? (
        <Select
          id={id}
          label={`Giá trị mẫu cho ${variable.label}`}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-8 text-xs"
          onChange={(event) => onChange(event.target.value)}
        >
          {!variable.required && <option value="">Không chọn</option>}
          {variable.options.filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}
        </Select>
      ) : (
        <Input
          id={id}
          type={variable.type === "number" ? "number" : "text"}
          value={value}
          aria-label={`Giá trị mẫu cho ${variable.label}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-8 text-xs"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-[10px] leading-3 text-danger">{error}</p>}
    </div>
  )
}

function AuthoringBreadcrumb({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="pl-10 lg:pl-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <button
            type="button"
            className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            onClick={onBack}
          >
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
    { step: 1, label: "Chỉnh sửa nội dung", description: "Nhập thông tin cơ bản, viết prompt và khai báo biến" },
    { step: 2, label: "Xem trước & hoàn thành", description: "Kiểm tra và lưu template" },
  ]

  return (
    <ol aria-label="Các bước tạo template" className="mt-5 grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => {
        const active = item.step === step
        const complete = item.step < step
        return (
          <li key={item.step} className="relative min-w-0">
            {index === 0 && <span aria-hidden="true" className="absolute left-9 right-[-0.75rem] top-4 hidden h-px bg-border sm:block" />}
            <button
              type="button"
              aria-current={active ? "step" : undefined}
              className="relative flex w-full items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              onClick={() => onStepChange(item.step)}
            >
              <span className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold",
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : complete
                    ? "border-info bg-info text-white"
                    : "border-border bg-muted text-muted-foreground",
              )}>
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

function PromptEditor({ value, error, onChange }: { value: string; error?: string; onChange: (value: string) => void }) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineCount = Math.max(1, value.split("\n").length)
  return (
    <div>
      <label htmlFor="template-content" className="sr-only">Nội dung prompt</label>
      <div className={cn(
        "grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] overflow-hidden rounded-md border bg-muted/25",
        error ? "border-danger/45" : "border-input",
      )}>
        <div ref={gutterRef} aria-hidden="true" className="max-h-[15rem] overflow-hidden border-r border-border bg-muted/50 py-2 font-mono text-[11px] leading-5 text-muted-foreground/65">
          {Array.from({ length: lineCount }, (_, index) => <span key={index} className="block pr-2 text-right tabular-nums">{index + 1}</span>)}
        </div>
        <Textarea
          id="template-content"
          translate="no"
          value={value}
          wrap="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "template-content-error" : undefined}
          className="min-h-[15rem] max-h-[15rem] resize-none rounded-none border-0 bg-surface px-3 py-2 font-mono text-xs leading-5 shadow-none focus:ring-0"
          onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop }}
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

const variableTypeLabels: Record<VariableType, string> = {
  text: "Văn bản",
  multiline: "Đa dòng",
  number: "Số",
  select: "Chọn một",
}

function VariableEditor({
  variables,
  errors,
  expandedVariableId,
  onExpandedVariableChange,
  onUpdate,
  onRemove,
}: {
  variables: TemplateVariableDefinition[]
  errors: FieldErrors
  expandedVariableId: string | null
  onExpandedVariableChange: (id: string | null) => void
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
    <div className="mt-3 overflow-x-auto rounded-md border border-border bg-surface">
      <div className="min-w-[680px] divide-y divide-border">
        {variables.map((variable) => {
          const prefix = `variable.${variable.id}`
          const isExpanded = expandedVariableId === variable.id
          const hasError = Object.keys(errors).some((key) => key.startsWith(`${prefix}.`))
          const detailId = `${variable.id}-detail`

          return (
            <div key={variable.id} className={cn(isExpanded && "bg-muted/16")}>
              <div className={cn("flex h-11 items-center px-3 transition-colors hover:bg-muted/30", hasError && "bg-danger-soft/35")}>
                <GripVertical aria-hidden="true" className="mr-2 size-3.5 shrink-0 text-muted-foreground/55" />
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={detailId}
                  aria-label={`${isExpanded ? "Thu gọn" : "Mở chi tiết"} biến ${variable.name || "chưa đặt tên"}`}
                  className="grid min-w-0 flex-1 grid-cols-[minmax(7rem,.8fr)_minmax(8rem,1.25fr)_7.5rem_7rem_1.25rem] items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  onClick={() => onExpandedVariableChange(isExpanded ? null : variable.id)}
                >
                  <code translate="no" className="truncate font-mono text-xs font-semibold text-accent-strong">
                    {variable.name || "chưa_đặt_tên"}
                  </code>
                  <span className="truncate text-xs text-primary">{variable.label || "Chưa có nhãn"}</span>
                  <Badge variant="info" className="justify-self-start">{variableTypeLabels[variable.type]}</Badge>
                  <Badge variant={variable.required ? "danger" : "neutral"} className="justify-self-start">
                    {variable.required ? "Bắt buộc" : "Tùy chọn"}
                  </Badge>
                  {isExpanded
                    ? <ChevronUp aria-hidden="true" className="size-4 text-primary" />
                    : <ChevronDown aria-hidden="true" className="size-4 text-primary" />}
                </button>
              </div>

              {isExpanded && (
                <div id={detailId} role="region" aria-label={`Chi tiết biến ${variable.name || "chưa đặt tên"}`} className="border-t border-border bg-muted/22 px-5 py-4">
                  <div className="grid grid-cols-12 gap-3">
                    <Field label="Tên biến" htmlFor={`${variable.id}-name`} required error={errors[`${prefix}.name`]} className="col-span-3">
                      <Input
                        id={`${variable.id}-name`}
                        value={variable.name}
                        aria-invalid={Boolean(errors[`${prefix}.name`])}
                        aria-describedby={errors[`${prefix}.name`] ? `${variable.id}-name-error` : `${variable.id}-name-description`}
                        className="h-8 font-mono text-xs"
                        placeholder="Ví dụ: variable_name…"
                        translate="no"
                        spellCheck={false}
                        onChange={(event) => onUpdate(variable.id, { name: event.target.value })}
                      />
                      {!errors[`${prefix}.name`] && <p id={`${variable.id}-name-description`} className="text-[10px] leading-3 text-muted-foreground">Chỉ dùng chữ thường, số và dấu gạch dưới.</p>}
                    </Field>

                    <Field label="Nhãn hiển thị" htmlFor={`${variable.id}-label`} required error={errors[`${prefix}.label`]} className="col-span-3">
                      <Input
                        id={`${variable.id}-label`}
                        value={variable.label}
                        aria-invalid={Boolean(errors[`${prefix}.label`])}
                        aria-describedby={errors[`${prefix}.label`] ? `${variable.id}-label-error` : `${variable.id}-label-description`}
                        className="h-8 text-xs"
                        placeholder="Ví dụ: Chủ đề video…"
                        onChange={(event) => onUpdate(variable.id, { label: event.target.value })}
                      />
                      {!errors[`${prefix}.label`] && <p id={`${variable.id}-label-description`} className="text-[10px] leading-3 text-muted-foreground">Tên người dùng nhìn thấy khi nhập giá trị.</p>}
                    </Field>

                    <Field label="Kiểu dữ liệu" htmlFor={`${variable.id}-type`} required className="col-span-4">
                      <Select
                        id={`${variable.id}-type`}
                        label="Kiểu dữ liệu"
                        value={variable.type}
                        className="h-8 text-xs"
                        onChange={(event) => {
                          const type = event.target.value as VariableType
                          const options = type === "select" ? (variable.options.length ? variable.options : ["Tùy chọn 1"]) : []
                          onUpdate(variable.id, {
                            type,
                            options,
                            defaultValue: type === "select" && !options.includes(variable.defaultValue)
                              ? (options[0] ?? "")
                              : variable.defaultValue,
                          })
                        }}
                      >
                        {(Object.entries(variableTypeLabels) as Array<[VariableType, string]>).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </Field>

                    <div className="col-span-2 space-y-1.5">
                      <span className="block text-xs font-semibold text-foreground">Bắt buộc</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={variable.required}
                        aria-label={`${variable.label || variable.name || "Biến"}: bắt buộc`}
                        className="inline-flex h-7 w-12 items-center rounded-full bg-border-strong p-0.5 transition-colors hover:bg-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 data-[checked=true]:bg-accent data-[checked=true]:hover:bg-accent-strong"
                        data-checked={variable.required}
                        onClick={() => onUpdate(variable.id, { required: !variable.required })}
                      >
                        <span className={cn("size-6 rounded-full bg-white shadow-sm transition-transform", variable.required && "translate-x-5")} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Mô tả" htmlFor={`${variable.id}-description`}>
                      <Input
                        id={`${variable.id}-description`}
                        value={variable.description}
                        className="h-8 text-xs"
                        placeholder="Mô tả cách sử dụng biến…"
                        onChange={(event) => onUpdate(variable.id, { description: event.target.value })}
                      />
                    </Field>
                    <VariableDefaultField variable={variable} onUpdate={onUpdate} />
                  </div>

                  {variable.type === "select" && (
                    <div className="mt-3">
                      <Field label="Options" htmlFor={`${variable.id}-options`} required error={errors[`${prefix}.options`]} description="Phân tách từng tùy chọn bằng dấu phẩy.">
                        <Input
                          id={`${variable.id}-options`}
                          value={variable.options.join(", ")}
                          aria-invalid={Boolean(errors[`${prefix}.options`])}
                          aria-describedby={errors[`${prefix}.options`] ? `${variable.id}-options-error` : `${variable.id}-options-description`}
                          className="h-8 text-xs"
                          placeholder="Ví dụ: Hài hước, Nghiêm túc, Gần gũi…"
                          onChange={(event) => {
                            const options = parseOptions(event.target.value)
                            onUpdate(variable.id, {
                              options,
                              defaultValue: options.includes(variable.defaultValue) ? variable.defaultValue : (options[0] ?? ""),
                            })
                          }}
                        />
                      </Field>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end border-t border-border pt-3">
                    <Button type="button" variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => onRemove(variable.id)}>
                      <Trash2 aria-hidden="true" />
                      Xóa biến
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VariableDefaultField({ variable, onUpdate }: {
  variable: TemplateVariableDefinition
  onUpdate: (id: string, patch: Partial<TemplateVariableDefinition>) => void
}) {
  if (variable.type === "select") {
    return (
      <Field label="Giá trị mặc định" htmlFor={`${variable.id}-default`} description="Giá trị được điền sẵn khi xem trước prompt.">
        <Select
          id={`${variable.id}-default`}
          label="Giá trị mặc định"
          value={variable.defaultValue}
          className="h-8 text-xs"
          onChange={(event) => onUpdate(variable.id, { defaultValue: event.target.value })}
        >
          <option value="">Không có</option>
          {variable.options.filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}
        </Select>
      </Field>
    )
  }

  return (
    <Field label="Giá trị mặc định" htmlFor={`${variable.id}-default`} description="Giá trị được điền sẵn khi xem trước prompt.">
      {variable.type === "multiline" ? (
        <Textarea
          id={`${variable.id}-default`}
          value={variable.defaultValue}
          className="min-h-20 text-xs"
          placeholder="Giá trị mặc định…"
          onChange={(event) => onUpdate(variable.id, { defaultValue: event.target.value })}
        />
      ) : (
        <Input
          id={`${variable.id}-default`}
          type={variable.type === "number" ? "number" : "text"}
          value={variable.defaultValue}
          className="h-8 text-xs"
          placeholder="Giá trị mặc định…"
          onChange={(event) => onUpdate(variable.id, { defaultValue: event.target.value })}
        />
      )}
    </Field>
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

export { TemplateAuthoringPage }
export type { AuthoringMode }
