import {
  Archive,
  BadgeCheck,
  Boxes,
  CircleAlert,
  CircleOff,
  FileImage,
  FileVideo,
  FolderOpen,
  HardDrive,
  PackageOpen,
  Plus,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import type {
  AssetProjection,
  AssetSlot,
  EpisodeAggregate,
  MediaType,
  Scene,
} from "../../../shared/domain"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SearchField } from "@/components/ui/search-field"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, unwrapResult } from "@/data/studio-client"
import { cn } from "@/lib/utils"

type SlotStatusFilter = "all" | AssetSlot["status"]

const slotStatus = {
  draft: { label: "Nháp", variant: "neutral" as const },
  ready: { label: "Sẵn sàng", variant: "info" as const },
  fulfilled: { label: "Đã đủ media", variant: "success" as const },
}

const assetStatus = {
  candidate: { label: "Candidate", variant: "info" as const },
  accepted: { label: "Accepted", variant: "success" as const },
  rejected: { label: "Rejected", variant: "neutral" as const },
}

const integrityStatus = {
  unattached: { label: "Chưa gắn file", className: "text-muted-foreground", icon: CircleOff },
  available: { label: "File hợp lệ", className: "text-success", icon: BadgeCheck },
  missing: { label: "Thiếu file", className: "text-danger", icon: CircleAlert },
  hash_mismatch: { label: "File đã bị sửa", className: "text-danger", icon: CircleAlert },
}

function sceneLabel(scene: Pick<Scene, "canonicalNo" | "title">) {
  return `${String(scene.canonicalNo).padStart(2, "0")} — ${scene.title}`
}

function formatBytes(value: number | null) {
  if (value === null) return "—"
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`
  return `${(value / 1024 ** 3).toFixed(2)} GiB`
}

function MediaBadge({ type }: { type: MediaType }) {
  const Icon = type === "image" ? FileImage : FileVideo
  return <Badge variant={type === "image" ? "info" : "lavender"}><Icon aria-hidden="true" className="size-3" />{type === "image" ? "Image" : "Video"}</Badge>
}

function IntegrityLabel({ asset }: { asset: AssetProjection }) {
  const item = integrityStatus[asset.fileIntegrity]
  const Icon = item.icon
  return <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", item.className)}><Icon aria-hidden="true" className="size-3.5" />{item.label}</span>
}

function CandidateRow({
  asset,
  busy,
  onAction,
}: {
  asset: AssetProjection
  busy: boolean
  onAction: (action: "accept" | "reject" | "archive" | "verify" | "open" | "reveal", asset: AssetProjection) => void
}) {
  return (
    <article className="rounded-lg border border-border bg-background/35 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-primary">{asset.fileName ?? "Candidate chưa có file"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{formatBytes(asset.bytes)} · {asset.mimeType ?? "Không rõ MIME"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5"><Badge variant={assetStatus[asset.status].variant}>{assetStatus[asset.status].label}</Badge><IntegrityLabel asset={asset} /></div>
      </div>
      <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">SHA-256: {asset.sha256 ?? "—"}</p>
      {(asset.fileIntegrity === "missing" || asset.fileIntegrity === "hash_mismatch") && (
        <p className="mt-2 rounded-md bg-danger-soft px-2.5 py-2 text-[11px] text-danger">
          Lifecycle {asset.status} được giữ nguyên. Hãy khôi phục file hoặc import candidate mới; ứng dụng không tự accept/reject theo integrity.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAction("verify", asset)}><RefreshCw aria-hidden="true" />Kiểm tra lại</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || asset.fileIntegrity === "missing" || asset.fileIntegrity === "unattached"} onClick={() => onAction("open", asset)}><FolderOpen aria-hidden="true" />Mở file</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || asset.fileIntegrity === "missing" || asset.fileIntegrity === "unattached"} onClick={() => onAction("reveal", asset)}><HardDrive aria-hidden="true" />Hiện thư mục</Button>
        {asset.status !== "accepted" && <Button type="button" size="sm" variant="accent" disabled={busy || asset.fileIntegrity !== "available" || asset.slot.status === "draft"} onClick={() => onAction("accept", asset)}><BadgeCheck aria-hidden="true" />Accept</Button>}
        {asset.status !== "rejected" && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAction("reject", asset)}>Reject</Button>}
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAction("archive", asset)}><Archive aria-hidden="true" />Lưu trữ</Button>
      </div>
    </article>
  )
}

function EpisodeAssetsTab({
  episode,
  refreshEpisode,
  onDirtyChange,
}: {
  episode: EpisodeAggregate
  refreshEpisode: () => Promise<EpisodeAggregate>
  onDirtyChange: (dirty: boolean) => void
}) {
  const [slots, setSlots] = useState<AssetSlot[]>([])
  const [candidates, setCandidates] = useState<AssetProjection[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [query, setQuery] = useState("")
  const [mediaType, setMediaType] = useState<"all" | MediaType>("all")
  const [status, setStatus] = useState<SlotStatusFilter>("all")
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [failure, setFailure] = useState("")
  const [prompt, setPrompt] = useState("")
  const [draftMediaType, setDraftMediaType] = useState<MediaType>("image")
  const [required, setRequired] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSceneId, setCreateSceneId] = useState(episode.scenes[0]?.id ?? "")
  const [createPrompt, setCreatePrompt] = useState("")
  const [createMediaType, setCreateMediaType] = useState<MediaType>("image")
  const [archiveTarget, setArchiveTarget] = useState<AssetProjection | null>(null)
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null)
  const request = useRef(0)

  const selected = slots.find((slot) => slot.id === selectedId) ?? null
  const scenes = useMemo(() => new Map(episode.scenes.map((scene) => [scene.id, scene])), [episode.scenes])
  const dirty = selected !== null && (prompt !== selected.prompt || draftMediaType !== selected.mediaType || required !== selected.required)

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  async function loadSlots(preferredId?: string) {
    const requestId = ++request.current
    setLoadState("loading")
    setFailure("")
    try {
      const next = await unwrapResult(window.studio.assetSlots.list({ episodeId: episode.id }))
      if (requestId !== request.current) return
      setSlots(next)
      setSelectedId((current) => preferredId && next.some((slot) => slot.id === preferredId)
        ? preferredId
        : next.some((slot) => slot.id === current) ? current : next[0]?.id ?? "")
      setLoadState("ready")
    } catch (error) {
      if (requestId === request.current) {
        setFailure(errorMessage(error, "Không thể tải AssetSlot."))
        setLoadState("error")
      }
    }
  }

  async function loadCandidates(slotId: string) {
    try {
      const page = await unwrapResult(window.studio.assets.list({ episodeId: episode.id, assetSlotId: slotId, pageSize: 100 }))
      setCandidates(page.items)
    } catch (error) {
      setFailure(errorMessage(error, "Không thể tải candidate."))
    }
  }

  useEffect(() => { void loadSlots() }, [episode.id])
  useEffect(() => {
    if (!selectedId) { setCandidates([]); return }
    void loadCandidates(selectedId)
  }, [episode.id, selectedId])
  useEffect(() => {
    if (!selected) return
    setPrompt(selected.prompt)
    setDraftMediaType(selected.mediaType)
    setRequired(selected.required)
  }, [selected?.id, selected?.revisionNo])

  const filteredSlots = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi")
    return slots.filter((slot) => {
      const scene = scenes.get(slot.sceneId)
      const matchesQuery = !normalized || [slot.canonicalName, slot.prompt, scene?.title ?? ""].some((value) => value.toLocaleLowerCase("vi").includes(normalized))
      return matchesQuery && (mediaType === "all" || slot.mediaType === mediaType) && (status === "all" || slot.status === status)
    })
  }, [mediaType, query, scenes, slots, status])

  async function refreshAfterMutation(slotId: string) {
    await refreshEpisode()
    await loadSlots(slotId)
    await loadCandidates(slotId)
  }

  async function saveSlot() {
    if (!selected || !dirty) return
    setBusy(true); setFailure(""); setNotice("")
    try {
      const updated = await unwrapResult(window.studio.assetSlots.update({
        id: selected.id,
        expectedRevisionNo: selected.revisionNo,
        patch: { prompt, mediaType: draftMediaType, required },
      }))
      setSlots((current) => current.map((slot) => slot.id === updated.id ? updated : slot))
      setNotice(`Đã lưu ${updated.canonicalName}.`)
      await refreshEpisode()
    } catch (error) {
      setFailure(errorMessage(error, "Không thể lưu AssetSlot; bản nháp vẫn được giữ."))
    } finally { setBusy(false) }
  }

  async function createSlot() {
    const scene = episode.scenes.find((item) => item.id === createSceneId)
    if (!scene) return
    setBusy(true); setFailure(""); setNotice("")
    try {
      const created = await unwrapResult(window.studio.assetSlots.create({
        episodeId: episode.id,
        sceneId: scene.id,
        expectedSceneRevisionNo: scene.revisionNo,
        mediaType: createMediaType,
        prompt: createPrompt,
        required: true,
      }))
      setCreateOpen(false); setCreatePrompt("")
      await refreshAfterMutation(created.id)
      setNotice(`Đã tạo ${created.canonicalName}.`)
    } catch (error) { setFailure(errorMessage(error, "Không thể tạo AssetSlot.")) }
    finally { setBusy(false) }
  }

  async function importFile() {
    if (!selected) return
    setBusy(true); setFailure(""); setNotice("")
    try {
      const result = await unwrapResult(window.studio.assets.importFile({ assetSlotId: selected.id, expectedAssetSlotRevisionNo: selected.revisionNo }))
      if (result.cancelled || !result.asset) { setNotice("Đã hủy chọn file; không có dữ liệu nào thay đổi."); return }
      await refreshAfterMutation(selected.id)
      setNotice(`Đã import ${result.asset.fileName ?? "candidate"}. File nguồn không bị thay đổi.`)
    } catch (error) { setFailure(errorMessage(error, "Không thể import file.")) }
    finally { setBusy(false) }
  }

  async function candidateAction(action: "accept" | "reject" | "archive" | "verify" | "open" | "reveal", asset: AssetProjection) {
    if (action === "archive") { setArchiveTarget(asset); return }
    setBusy(true); setFailure(""); setNotice("")
    try {
      if (action === "accept") await unwrapResult(window.studio.assets.accept({ id: asset.id, expectedRevisionNo: asset.revisionNo }))
      if (action === "reject") await unwrapResult(window.studio.assets.reject({ id: asset.id, expectedRevisionNo: asset.revisionNo }))
      if (action === "verify") {
        const checked = await unwrapResult(window.studio.assets.verifyIntegrity({ id: asset.id }))
        setNotice(`Integrity: ${integrityStatus[checked.fileIntegrity].label}. Lifecycle ${checked.status} không thay đổi.`)
      }
      if (action === "open") await unwrapResult(window.studio.assets.openFile({ id: asset.id }))
      if (action === "reveal") await unwrapResult(window.studio.assets.revealFile({ id: asset.id }))
      if (action === "accept" || action === "reject" || action === "verify") await refreshAfterMutation(asset.assetSlotId)
    } catch (error) { setFailure(errorMessage(error, "Không thể thực hiện thao tác Asset.")) }
    finally { setBusy(false) }
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    const target = archiveTarget
    setArchiveTarget(null); setBusy(true); setFailure("")
    try {
      await unwrapResult(window.studio.assets.archive({ id: target.id, expectedRevisionNo: target.revisionNo }))
      await refreshAfterMutation(target.assetSlotId)
      setNotice("Đã lưu trữ candidate. Binary trong workspace không bị xóa.")
    } catch (error) { setFailure(errorMessage(error, "Không thể lưu trữ candidate.")) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(25rem,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-panel" aria-labelledby="asset-slots-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div><div className="flex items-center gap-2.5"><Boxes aria-hidden="true" className="size-5 text-primary" /><h2 id="asset-slots-title" className="text-base font-bold text-primary">Asset planning ({slots.length})</h2></div><p className="mt-1 pl-[30px] text-[11px] text-muted-foreground">AssetSlot là đầu ra cần có; candidate là file thực tế để review.</p></div>
            <Button type="button" variant="accent" onClick={() => setCreateOpen((value) => !value)}><Plus aria-hidden="true" />Thêm slot</Button>
          </div>
          {createOpen && <div className="grid gap-3 border-b border-border bg-accent-soft/25 p-4 sm:grid-cols-2">
            <Select label="Scene" value={createSceneId} onChange={(event) => setCreateSceneId(event.target.value)}>{episode.scenes.map((scene) => <option key={scene.id} value={scene.id}>{sceneLabel(scene)}</option>)}</Select>
            <Select label="Loại media" value={createMediaType} onChange={(event) => setCreateMediaType(event.target.value as MediaType)}><option value="image">Image</option><option value="video">Video</option></Select>
            <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-primary">Prompt</span><Textarea value={createPrompt} maxLength={20_000} onChange={(event) => setCreatePrompt(event.target.value)} /></label>
            <div className="flex gap-2 sm:col-span-2"><Button type="button" size="sm" variant="accent" disabled={busy} onClick={() => void createSlot()}>Tạo slot</Button><Button type="button" size="sm" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button></div>
          </div>}
          <div className="grid gap-2 border-b border-border bg-background/25 p-3 md:grid-cols-3">
            <SearchField label="Tìm AssetSlot" value={query} placeholder="Scene, canonical, prompt…" onChange={(event) => setQuery(event.target.value)} />
            <Select label="Loại media" value={mediaType} onChange={(event) => setMediaType(event.target.value as "all" | MediaType)}><option value="all">Tất cả</option><option value="image">Image</option><option value="video">Video</option></Select>
            <Select label="Trạng thái slot" value={status} onChange={(event) => setStatus(event.target.value as SlotStatusFilter)}><option value="all">Tất cả</option><option value="draft">Nháp</option><option value="ready">Sẵn sàng</option><option value="fulfilled">Đã đủ media</option></Select>
          </div>
          {(notice || failure) && <div role={failure ? "alert" : "status"} className={cn("border-b px-4 py-2 text-xs", failure ? "border-danger/15 bg-danger-soft text-danger" : "border-info/15 bg-info-soft text-info")}>{failure || notice}</div>}
          <div className="max-h-[650px] overflow-y-auto p-3">
            {loadState === "loading" ? <p className="p-8 text-center text-xs text-muted-foreground">Đang tải AssetSlot…</p> : loadState === "error" ? <div className="p-8 text-center"><p className="text-xs text-danger">{failure}</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void loadSlots()}>Thử lại</Button></div> : filteredSlots.length ? <div className="overflow-hidden rounded-lg border border-border">{filteredSlots.map((slot) => {
              const scene = scenes.get(slot.sceneId)
              return <button key={slot.id} type="button" aria-pressed={slot.id === selectedId} onClick={() => { if (dirty && slot.id !== selectedId) setPendingSelectedId(slot.id); else setSelectedId(slot.id) }} className={cn("flex w-full items-center gap-3 border-b border-border p-3 text-left last:border-b-0 hover:bg-muted/45", slot.id === selectedId && "bg-selected")}><span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-primary">{slot.mediaType === "image" ? <FileImage aria-hidden="true" className="size-5" /> : <FileVideo aria-hidden="true" className="size-5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-primary">{slot.canonicalName}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{scene ? sceneLabel(scene) : "Scene không tồn tại"}</span></span><Badge variant={slotStatus[slot.status].variant}>{slotStatus[slot.status].label}</Badge></button>
            })}</div> : <div className="grid min-h-72 place-items-center text-center"><div><PackageOpen aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-2 text-sm font-bold text-primary">Không có AssetSlot phù hợp</h3><p className="mt-1 text-xs text-muted-foreground">Thử đổi bộ lọc hoặc tạo slot mới.</p></div></div>}
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-surface p-4 shadow-panel">
          {selected ? <>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">AssetSlot</p><h2 className="mt-1 text-lg font-bold text-primary">{selected.canonicalName}</h2><p className="mt-1 text-xs text-muted-foreground">{scenes.get(selected.sceneId) ? sceneLabel(scenes.get(selected.sceneId)!) : "Scene không tồn tại"}</p></div><Badge variant={slotStatus[selected.status].variant}>{slotStatus[selected.status].label}</Badge></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><span className="mb-1.5 block text-xs font-semibold text-primary">Loại media</span><Select label="Loại media AssetSlot" value={draftMediaType} onChange={(event) => setDraftMediaType(event.target.value as MediaType)}><option value="image">Image</option><option value="video">Video</option></Select></div>
              <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-primary"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} className="size-4 accent-[var(--accent)]" />Slot bắt buộc</label>
              <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-primary">Prompt</span><Textarea value={prompt} maxLength={20_000} className="min-h-32" onChange={(event) => setPrompt(event.target.value)} /></label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] text-muted-foreground">Canonical name và slot order không đổi khi reorder Scene.</p><Button type="button" size="sm" variant="accent" disabled={!dirty || busy} onClick={() => void saveSlot()}><Save aria-hidden="true" />Lưu slot</Button></div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-primary">Candidates ({candidates.length})</h3><p className="mt-1 text-[11px] text-muted-foreground">Accept/reject là quyết định thủ công; integrity không tự đổi lifecycle.</p></div><Button type="button" variant="accent" disabled={busy || dirty} onClick={() => void importFile()}><Upload aria-hidden="true" />Import file</Button></div>
              {dirty && <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-[11px] text-warning">Lưu thay đổi AssetSlot trước khi import file.</p>}
              <div className="mt-3 space-y-3">{candidates.length ? candidates.map((asset) => <CandidateRow key={asset.id} asset={asset} busy={busy} onAction={(action, item) => void candidateAction(action, item)} />) : <div className="rounded-lg border border-dashed border-border p-6 text-center"><Upload aria-hidden="true" className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 text-xs font-semibold text-primary">Chưa có candidate</p><p className="mt-1 text-[11px] text-muted-foreground">Import ảnh/video thủ công để review.</p></div>}</div>
            </div>
          </> : <div className="grid min-h-[32rem] place-items-center text-center"><div><Boxes aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><p className="mt-2 text-sm font-bold text-primary">Chọn một AssetSlot</p></div></div>}
        </aside>
      </div>
      <ConfirmDialog open={archiveTarget !== null} onOpenChange={(open) => { if (!open) setArchiveTarget(null) }} title="Lưu trữ candidate?" description="Candidate sẽ ẩn khỏi danh sách. File binary trong workspace không bị xóa." cancelLabel="Hủy" confirmLabel="Lưu trữ" onConfirm={() => void confirmArchive()} />
      <ConfirmDialog open={pendingSelectedId !== null} onOpenChange={(open) => { if (!open) setPendingSelectedId(null) }} title="Bỏ thay đổi AssetSlot chưa lưu?" description="Prompt, loại media hoặc required đang chỉnh sẽ bị bỏ khi chuyển sang AssetSlot khác." cancelLabel="Tiếp tục chỉnh" confirmLabel="Bỏ thay đổi" onConfirm={() => { const next = pendingSelectedId; setPendingSelectedId(null); if (next) setSelectedId(next) }} />
    </>
  )
}

export { EpisodeAssetsTab }
