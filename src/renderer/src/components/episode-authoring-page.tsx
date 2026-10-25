import {
  Atom,
  BrainCircuit,
  ChevronLeft,
  CircleCheck,
  Clock3,
  FileText,
  HeartPulse,
  Image as ImageIcon,
  ImagePlus,
  Landmark,
  Lightbulb,
  ListChecks,
  PawPrint,
  Save,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"

import type { Episode, EpisodeTopic, EpisodeWorkflowStatus } from "../../../shared/domain"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { ErrorState, LoadingState } from "@/components/ui/state-feedback"
import { Textarea } from "@/components/ui/textarea"
import { StudioClientError, errorMessage, localActorName, unwrapResult } from "@/data/studio-client"
import { cn } from "@/lib/utils"

type EpisodeAuthoringMode = "create" | "edit"

type EpisodeDraft = {
  description: string
  notes: string
  status: EpisodeWorkflowStatus
  title: string
  topic: EpisodeTopic
}

const thumbnailOptions = [
  { id: "sleep", alt: "Người đang ngủ với những bong bóng giấc mơ", src: "/episode-thumbnails/dream-sleep.png" },
  { id: "portal", alt: "Người quan sát một vòng xoáy giấc mơ", src: "/episode-thumbnails/dream-portal.png" },
  { id: "meditation", alt: "Người thiền định trong không gian mộng tưởng", src: "/episode-thumbnails/dream-meditation.png" },
  { id: "doorway", alt: "Người bước về phía cánh cửa giấc mơ", src: "/episode-thumbnails/dream-doorway.png" },
] as const

const topics = {
  animals: { icon: PawPrint, label: "Động vật" },
  health: { icon: HeartPulse, label: "Cơ thể" },
  history: { icon: Landmark, label: "Lịch sử" },
  psychology: { icon: BrainCircuit, label: "Tâm lý" },
  science: { icon: Atom, label: "Khoa học" },
} satisfies Record<EpisodeTopic, { icon: typeof BrainCircuit; label: string }>

const statuses = {
  draft: { icon: Lightbulb, label: "Ý tưởng", tone: "text-warning bg-warning-soft" },
  scenes_ready: { icon: ListChecks, label: "Scenes sẵn sàng", tone: "text-success bg-success-soft" },
  producing: { icon: Clock3, label: "Đang sản xuất", tone: "text-info bg-info-soft" },
  ready_to_export: { icon: CircleCheck, label: "Sẵn sàng xuất", tone: "text-success bg-success-soft" },
} satisfies Record<EpisodeWorkflowStatus, { icon: typeof Lightbulb; label: string; tone: string }>

const createDraft: EpisodeDraft = {
  title: "Tại sao chúng ta lại mơ?",
  topic: "psychology",
  status: "draft",
  description: "Giải thích về giấc mơ, tại sao chúng ta mơ và ý nghĩa của những giấc mơ kỳ lạ.",
  notes: "",
}

function getEpisodeListHref() {
  return `${window.location.pathname}#episodes`
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)))
  }
  return btoa(binary)
}

function EpisodeAuthoringPage({ mode, episodeId }: { mode: EpisodeAuthoringMode; episodeId?: string }) {
  const [effectiveMode, setEffectiveMode] = useState(mode)
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [draft, setDraft] = useState<EpisodeDraft>(() => ({ ...createDraft }))
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(thumbnailOptions[0].src)
  const [thumbnailRelativePath, setThumbnailRelativePath] = useState<string | null>(null)
  const [removedThumbnail, setRemovedThumbnail] = useState<{ preview: string; relativePath: string | null } | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof EpisodeDraft, string>>>({})
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle")
  const [isDirty, setIsDirty] = useState(false)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(mode === "edit" ? "loading" : "ready")
  const [saving, setSaving] = useState(false)
  const [thumbnailSaving, setThumbnailSaving] = useState(false)
  const [actionError, setActionError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const listHref = getEpisodeListHref()
  const pageTitle = effectiveMode === "edit" ? "Chỉnh sửa episode" : "Tạo episode mới"

  useEffect(() => {
    if (mode !== "edit" || !episodeId) {
      if (mode === "edit") setLoadState("error")
      return
    }
    let active = true
    setLoadState("loading")
    void unwrapResult(window.studio.episodes.get({ id: episodeId }))
      .then(async (aggregate) => {
        if (!active) return
        setEpisode(aggregate)
        setDraft({
          title: aggregate.title,
          topic: aggregate.topic,
          status: aggregate.workflowStatus,
          description: aggregate.description,
          notes: aggregate.notes,
        })
        setThumbnailRelativePath(aggregate.thumbnailRelativePath)
        if (aggregate.thumbnailRelativePath) {
          const thumbnail = await unwrapResult(window.studio.episodeThumbnails.read({ relativePath: aggregate.thumbnailRelativePath }))
          if (active) setSelectedThumbnail(thumbnail.dataUrl)
        } else {
          setSelectedThumbnail(null)
        }
        if (active) setLoadState("ready")
      })
      .catch(() => { if (active) setLoadState("error") })
    return () => { active = false }
  }, [episodeId, mode])

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  function updateDraft<Key extends keyof EpisodeDraft>(key: Key, value: EpisodeDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setActionError("")
    setSaveState("idle")
    setIsDirty(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof EpisodeDraft, string>> = {}

    if (draft.title.trim().length < 3) nextErrors.title = "Tiêu đề cần có ít nhất 3 ký tự."
    if (!draft.topic) nextErrors.topic = "Chọn một chủ đề."
    if (draft.description.trim().length < 10) nextErrors.description = "Mô tả cần có ít nhất 10 ký tự."

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstKey = Object.keys(nextErrors)[0]
      document.getElementById(`episode-${firstKey}`)?.focus()
      return
    }

    setSaving(true)
    setActionError("")
    try {
      if (effectiveMode === "create") {
        const created = await unwrapResult(window.studio.episodes.create({
          title: draft.title.trim(),
          topic: draft.topic,
          description: draft.description.trim(),
          notes: draft.notes,
          thumbnailRelativePath,
          createdByName: localActorName,
        }))
        setEpisode(created)
        setEffectiveMode("edit")
        const url = new URL(window.location.href)
        url.searchParams.set("episodeAuthor", "edit")
        url.searchParams.set("episode", created.id)
        window.history.replaceState(null, "", url)
      } else {
        if (!episode) throw new Error("Episode chưa được tải.")
        const updated = await unwrapResult(window.studio.episodes.update({
          id: episode.id,
          expectedRevisionNo: episode.revisionNo,
          updatedByName: localActorName,
          patch: {
            title: draft.title.trim(),
            topic: draft.topic,
            description: draft.description.trim(),
            notes: draft.notes,
            thumbnailRelativePath,
          },
        }))
        setEpisode(updated)
      }
      setSaveState("saved")
      setIsDirty(false)
    } catch (error) {
      if (error instanceof StudioClientError && error.fieldErrors) {
        setErrors((current) => ({ ...current, ...error.fieldErrors }))
      }
      setActionError(errorMessage(error, "Không thể lưu Episode. Nội dung của bạn vẫn được giữ nguyên."))
    } finally {
      setSaving(false)
    }
  }

  async function handleThumbnailUpload(file: File | undefined) {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setActionError("Chỉ hỗ trợ thumbnail PNG, JPEG hoặc WebP.")
      return
    }
    setThumbnailSaving(true)
    setActionError("")
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const thumbnail = await unwrapResult(window.studio.episodeThumbnails.import({
        fileName: file.name,
        mimeType: file.type as "image/png" | "image/jpeg" | "image/webp",
        dataBase64: bytesToBase64(bytes),
      }))
      setSelectedThumbnail(thumbnail.dataUrl)
      setThumbnailRelativePath(thumbnail.relativePath)
      setRemovedThumbnail(null)
      setSaveState("idle")
      setIsDirty(true)
    } catch (error) {
      setActionError(errorMessage(error, "Không thể nhập thumbnail."))
    } finally {
      setThumbnailSaving(false)
    }
  }

  async function selectBundledThumbnail(option: (typeof thumbnailOptions)[number]) {
    try {
      const response = await fetch(option.src)
      const blob = await response.blob()
      await handleThumbnailUpload(new File([blob], `${option.id}.png`, { type: blob.type || "image/png" }))
    } catch (error) {
      setActionError(errorMessage(error, "Không thể nhập thumbnail gợi ý."))
    }
  }

  const CurrentTopicIcon = topics[draft.topic].icon
  const currentStatus = statuses[draft.status]
  const CurrentStatusIcon = currentStatus.icon

  if (loadState === "loading") return <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7"><LoadingState /></div>
  if (loadState === "error") return <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7"><ErrorState /></div>

  return (
    <div className="min-h-screen bg-background px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
      <header className="pl-10 lg:pl-0">
        <nav aria-label="Breadcrumb">
          <ol className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <li><a href={listHref} className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">Episodes</a></li>
            <li aria-hidden="true" className="text-border-strong">/</li>
            <li aria-current="page" className="truncate font-semibold text-primary">{pageTitle}</li>
          </ol>
        </nav>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-page-title tracking-[-0.025em] text-primary text-balance">{pageTitle}</h1>
            <p className="mt-0.5 text-sm leading-5 text-muted-foreground text-pretty">
              {effectiveMode === "edit"
                ? "Cập nhật thông tin và hình đại diện cho episode."
                : "Nhập thông tin cơ bản cho episode. Bạn có thể chỉnh sửa lại sau."}
            </p>
          </div>
          <Button asChild variant="outline" size="lg" className="self-start">
            <a href={listHref}><ChevronLeft aria-hidden="true" />Quay lại</a>
          </Button>
        </div>
      </header>

      <div className="mt-6 grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
        <section className="rounded-lg border border-border bg-surface p-5 shadow-panel sm:p-6" aria-labelledby="episode-information-title">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <FileText aria-hidden="true" className="size-5 text-info" />
            <h2 id="episode-information-title" className="text-base font-bold text-primary">Thông tin cơ bản</h2>
          </div>

          <form id="episode-form" className="mt-5 space-y-5" autoComplete="off" onSubmit={handleSubmit} noValidate>
            <Field
              label="Tiêu đề"
              htmlFor="episode-title"
              required
              meta={`${draft.title.length}/100`}
              error={errors.title}
              description="Tiêu đề ngắn gọn, thu hút và mô tả nội dung chính của video."
            >
              <Input
                id="episode-title"
                name="episode-title"
                autoComplete="off"
                value={draft.title}
                maxLength={100}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? "episode-title-error" : "episode-title-description"}
                onChange={(event) => updateDraft("title", event.target.value)}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Chủ đề" htmlFor="episode-topic" required error={errors.topic}>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-md bg-danger-soft text-danger">
                    <CurrentTopicIcon className="size-4" />
                  </span>
                  <Select
                    id="episode-topic"
                    name="episode-topic"
                    label="Chủ đề"
                    value={draft.topic}
                    aria-invalid={Boolean(errors.topic)}
                    className="h-11 pl-11"
                    onChange={(event) => updateDraft("topic", event.target.value as EpisodeTopic)}
                  >
                    {(Object.entries(topics) as Array<[EpisodeTopic, { label: string }]>).map(([value, item]) => (
                      <option key={value} value={value}>{item.label}</option>
                    ))}
                  </Select>
                </div>
              </Field>

              <Field label="Trạng thái" htmlFor="episode-status" description="Trạng thái được tính tự động từ Scenes và Assets.">
                <div className="relative">
                  <span aria-hidden="true" className={cn("pointer-events-none absolute left-2.5 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-md", currentStatus.tone)}>
                    <CurrentStatusIcon className="size-4" />
                  </span>
                  <Select
                    id="episode-status"
                    name="episode-status"
                    label="Trạng thái"
                    value={draft.status}
                    className="h-11 pl-11"
                    disabled
                  >
                    {(Object.entries(statuses) as Array<[EpisodeWorkflowStatus, { label: string }]>).map(([value, item]) => (
                      <option key={value} value={value}>{item.label}</option>
                    ))}
                  </Select>
                </div>
              </Field>
            </div>

            <Field
              label="Mô tả"
              htmlFor="episode-description"
              required
              meta={`${draft.description.length}/240`}
              error={errors.description}
              description="Mô tả ngắn về nội dung, giúp bạn dễ nhớ và quản lý episode."
            >
              <Textarea
                id="episode-description"
                name="episode-description"
                autoComplete="off"
                value={draft.description}
                maxLength={240}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "episode-description-error" : "episode-description-description"}
                className="min-h-28 text-sm leading-6"
                onChange={(event) => updateDraft("description", event.target.value)}
              />
            </Field>

            <Field
              label="Ghi chú (tùy chọn)"
              htmlFor="episode-notes"
              meta={`${draft.notes.length}/240`}
              description="Ghi chú riêng cho bạn, không hiển thị ra ngoài."
            >
              <Textarea
                id="episode-notes"
                name="episode-notes"
                autoComplete="off"
                value={draft.notes}
                maxLength={240}
                className="min-h-20 text-sm leading-6"
                placeholder="Thêm ghi chú nội bộ…"
                onChange={(event) => updateDraft("notes", event.target.value)}
              />
            </Field>
          </form>
        </section>

        <aside className="rounded-lg border border-border bg-surface p-5 shadow-panel sm:p-6" aria-labelledby="episode-thumbnail-title">
          <div className="flex items-center gap-3">
            <ImageIcon aria-hidden="true" className="size-5 text-info" />
            <h2 id="episode-thumbnail-title" className="text-base font-bold text-primary">Ảnh đại diện (Thumbnail)</h2>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Chọn ảnh để hiển thị ở danh sách episode. Nên dùng ảnh 16:9, tối thiểu 1280×720.
          </p>

          <div className="mt-4">
            {selectedThumbnail ? (
              <div className="group/preview relative aspect-video overflow-hidden rounded-lg border border-border bg-primary">
                <img
                  src={selectedThumbnail}
                  alt="Ảnh đại diện episode đang chọn"
                  width={1672}
                  height={941}
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label="Xóa ảnh đại diện"
                  className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-white/70 bg-surface/90 text-primary shadow-sm hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  onClick={() => {
                    setRemovedThumbnail({ preview: selectedThumbnail, relativePath: thumbnailRelativePath })
                    setSelectedThumbnail(null)
                    setThumbnailRelativePath(null)
                    setSaveState("idle")
                    setIsDirty(true)
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="grid aspect-video w-full place-items-center rounded-lg border border-dashed border-border-strong bg-muted/35 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                onClick={() => fileInputRef.current?.click()}
              >
                <span>
                  <ImagePlus aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
                  <span className="mt-2 block text-xs font-semibold text-primary">Chọn ảnh đại diện</span>
                </span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              name="episode-thumbnail"
              accept="image/*"
              className="sr-only"
              aria-label="Tải ảnh đại diện từ máy"
              onChange={(event) => void handleThumbnailUpload(event.target.files?.[0])}
            />
            <div className="mt-3 flex justify-center">
              <Button type="button" variant="outline" disabled={thumbnailSaving} onClick={() => fileInputRef.current?.click()}>
                <ImagePlus aria-hidden="true" />
                {thumbnailSaving ? "Đang nhập…" : selectedThumbnail ? "Thay đổi ảnh" : "Chọn ảnh"}
              </Button>
            </div>
            {removedThumbnail && !selectedThumbnail && (
              <p aria-live="polite" className="mt-2 text-center text-[11px] text-muted-foreground">
                Đã xóa ảnh.{' '}
                <button
                  type="button"
                  className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  onClick={() => {
                    setSelectedThumbnail(removedThumbnail.preview)
                    setThumbnailRelativePath(removedThumbnail.relativePath)
                    setRemovedThumbnail(null)
                    setIsDirty(true)
                  }}
                >
                  Hoàn tác
                </button>
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-xs font-bold text-primary">Gợi ý ảnh</h3>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {thumbnailOptions.map((thumbnail) => {
                const selected = selectedThumbnail === thumbnail.src
                return (
                  <button
                    key={thumbnail.id}
                    type="button"
                    aria-label={`Chọn ảnh: ${thumbnail.alt}`}
                    aria-pressed={selected}
                    className={cn(
                      "aspect-video overflow-hidden rounded-md border-2 bg-muted transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                      selected ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-transparent",
                    )}
                    onClick={() => void selectBundledThumbnail(thumbnail)}
                  >
                    <img
                      src={thumbnail.src}
                      alt=""
                      width={1672}
                      height={941}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      <footer className="mt-5 flex flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-4 shadow-panel sm:flex-row sm:items-center sm:justify-end">
        <p aria-live="polite" className={cn("min-h-5 text-xs font-medium sm:mr-auto", actionError ? "text-danger" : "text-success")}>
          {actionError || (saveState === "saved" ? "Đã lưu Episode vào database." : "")}
        </p>
        <Button asChild variant="outline" size="lg"><a href={listHref}>Hủy</a></Button>
        <Button type="submit" form="episode-form" variant="accent" size="lg" disabled={saving || thumbnailSaving}>
          {saveState === "saved" ? <CircleCheck aria-hidden="true" /> : <Save aria-hidden="true" />}
          {saving ? "Đang lưu…" : saveState === "saved" ? "Đã lưu" : "Lưu episode"}
        </Button>
      </footer>
    </div>
  )
}

export { EpisodeAuthoringPage }
export type { EpisodeAuthoringMode }
