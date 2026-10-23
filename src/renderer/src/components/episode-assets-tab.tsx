import {
  BadgeCheck,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Ellipsis,
  FileImage,
  FileVideo,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  LoaderCircle,
  Maximize2,
  PackageOpen,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SearchField } from "@/components/ui/search-field"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type AssetMediaType = "image" | "video"
type AssetStatus = "generating" | "ready" | "waiting"
type AssetView = "grid" | "list"
type AssetSort = "created" | "scene-asc" | "status"
type AssetSceneType = "B_ROLL" | "ENVIRONMENT" | "MAIN_CHARACTER" | "MOTION_GRAPHIC" | "SCIENTIFIC_VISUALIZATION"

type AssetRecord = {
  createdAt: string
  description: string
  dimensions: string
  duration?: number
  fileName: string
  fileSize: string
  id: string
  mediaType: AssetMediaType
  prompt: string
  sceneId: string
  sceneName: string
  sceneNumber: number
  sceneType: AssetSceneType
  status: AssetStatus
  thumbnail: string
}

const assetStatuses: Record<AssetStatus, { icon: LucideIcon; label: string; variant: "info" | "neutral" | "success" }> = {
  generating: { icon: LoaderCircle, label: "Đang tạo", variant: "info" },
  ready: { icon: BadgeCheck, label: "Đã tạo", variant: "success" },
  waiting: { icon: Clock3, label: "Chờ tạo", variant: "neutral" },
}

const thumbnails = [
  "/episode-thumbnails/peaceful-moments.png",
  "/episode-thumbnails/dream-doorway.png",
  "/episode-thumbnails/dream-meditation.png",
  "/episode-thumbnails/dream-sleep.png",
  "/episode-thumbnails/dream-portal.png",
] as const

const sceneSeeds: ReadonlyArray<{
  description: string
  name: string
  sceneType: AssetSceneType
}> = [
  { name: "Hook", description: "Cậu bé ngồi trước hiên nhà lúc hoàng hôn", sceneType: "MAIN_CHARACTER" },
  { name: "Mở đầu", description: "Không gian ngôi làng trong nắng sớm", sceneType: "ENVIRONMENT" },
  { name: "Giải thích", description: "Ánh sáng xuyên qua tán lá xanh", sceneType: "SCIENTIFIC_VISUALIZATION" },
  { name: "Ví dụ thực tế", description: "Chú mèo bước chậm qua thảm cỏ", sceneType: "ENVIRONMENT" },
  { name: "Phân tích sâu hơn", description: "Minh họa nhịp nghỉ ngơi của não bộ", sceneType: "MOTION_GRAPHIC" },
  { name: "Kết luận", description: "Hai nhân vật ngắm nhìn thung lũng", sceneType: "MAIN_CHARACTER" },
  { name: "Nhịp sống buổi sớm", description: "Khói bếp bay nhẹ trên mái ngói", sceneType: "B_ROLL" },
  { name: "Một phút lắng lại", description: "Nhân vật ngồi yên bên mặt hồ", sceneType: "MAIN_CHARACTER" },
  { name: "Âm thanh quanh ta", description: "Cành cây lay nhẹ trong gió", sceneType: "ENVIRONMENT" },
  { name: "Góc nhìn khoa học", description: "Minh họa nhịp tim và sóng não", sceneType: "SCIENTIFIC_VISUALIZATION" },
  { name: "Khoảnh khắc sẻ chia", description: "Tách trà ấm trên bàn gỗ", sceneType: "B_ROLL" },
  { name: "Outro", description: "Hoàng hôn phủ xuống thung lũng", sceneType: "B_ROLL" },
]

const initialAssets: AssetRecord[] = sceneSeeds.flatMap((scene, sceneIndex) =>
  [0, 1].map((variant) => {
    const sceneNumber = sceneIndex + 1
    const mediaType: AssetMediaType = (sceneIndex + variant) % 3 === 0 ? "video" : "image"
    const statusIndex = (sceneIndex * 2 + variant) % 7
    const status: AssetStatus = statusIndex === 3 ? "generating" : statusIndex === 5 ? "waiting" : "ready"
    const extension = mediaType === "video" ? "mp4" : "png"

    return {
      id: `asset-${String(sceneNumber).padStart(2, "0")}-${variant + 1}`,
      sceneId: `scene-${String(sceneNumber).padStart(2, "0")}`,
      sceneName: scene.name,
      sceneNumber,
      sceneType: scene.sceneType,
      description: variant === 0 ? scene.description : `${scene.description} — góc máy thay thế`,
      mediaType,
      status,
      duration: mediaType === "video" ? 5 + (sceneIndex % 3) : undefined,
      thumbnail: thumbnails[(sceneIndex + variant) % thumbnails.length] ?? thumbnails[0],
      prompt: `Khung hình điện ảnh cho cảnh ${String(sceneNumber).padStart(2, "0")} “${scene.name}”. ${scene.description}. Ánh sáng ấm, màu sắc tự nhiên, bố cục 16:9, phong cách hoạt hình giàu chi tiết.`,
      fileName: `scene_${String(sceneNumber).padStart(2, "0")}_${variant + 1}.${extension}`,
      fileSize: mediaType === "video" ? `${12 + sceneIndex}.${variant + 2} MB` : `${2 + (sceneIndex % 4)}.${variant + 1} MB`,
      dimensions: "1920×1080",
      createdAt: `2024-06-${String(14 - (sceneIndex % 3)).padStart(2, "0")}T${String(9 + (sceneIndex % 8)).padStart(2, "0")}:${variant === 0 ? "32" : "47"}:00+07:00`,
    }
  }),
)

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
})

function formatDuration(seconds?: number) {
  return `00:${String(seconds ?? 0).padStart(2, "0")}`
}

function sceneLabel(asset: AssetRecord) {
  return `${String(asset.sceneNumber).padStart(2, "0")} - ${asset.sceneName}`
}

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const presentation = assetStatuses[status]
  const Icon = presentation.icon
  return (
    <Badge variant={presentation.variant}>
      <Icon aria-hidden="true" className={cn("size-3", status === "generating" && "animate-spin motion-reduce:animate-none")} />
      {presentation.label}
    </Badge>
  )
}

function MediaBadge({ mediaType }: { mediaType: AssetMediaType }) {
  const Icon = mediaType === "video" ? FileVideo : FileImage
  return (
    <Badge variant={mediaType === "video" ? "lavender" : "info"}>
      <Icon aria-hidden="true" className="size-3" />
      {mediaType === "video" ? "Video" : "Image"}
    </Badge>
  )
}

function AssetCard({ asset, selected, onSelect }: { asset: AssetRecord; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group min-w-0 overflow-hidden rounded-lg border bg-surface text-left shadow-[0_1px_2px_rgb(20_42_74/0.025)] transition-[border-color,background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        selected
          ? "border-accent bg-selected shadow-[0_0_0_1px_var(--accent)]"
          : "border-border hover:-translate-y-0.5 hover:border-selected-border hover:shadow-panel",
      )}
    >
      <span className="relative block aspect-video overflow-hidden bg-muted">
        <img src={asset.thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-2 top-2 grid size-5 place-items-center rounded-[5px] border bg-surface/95 shadow-sm",
            selected ? "border-accent text-accent" : "border-white/80 text-transparent",
          )}
        >
          <BadgeCheck className="size-3.5" />
        </span>
        {asset.mediaType === "video" && (
          <span className="absolute right-2 top-2 rounded bg-primary/85 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
            {formatDuration(asset.duration)}
          </span>
        )}
      </span>
      <span className="block p-2.5">
        <span className="block truncate text-xs font-bold text-primary">{sceneLabel(asset)}</span>
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">{asset.description}</span>
        <span className="mt-2 flex items-center justify-between gap-1.5">
          <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <MediaBadge mediaType={asset.mediaType} />
            <AssetStatusBadge status={asset.status} />
          </span>
          <Ellipsis aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </span>
      </span>
    </button>
  )
}

function AssetListRow({ asset, selected, onSelect }: { asset: AssetRecord; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30",
        selected ? "bg-selected" : "bg-surface hover:bg-muted/35",
      )}
    >
      <span className="relative block aspect-video overflow-hidden rounded-md border border-border bg-muted">
        <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" />
        {asset.mediaType === "video" && <Play aria-hidden="true" className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-primary">{sceneLabel(asset)}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{asset.description}</span>
        <span className="mt-1.5 flex items-center gap-1.5"><MediaBadge mediaType={asset.mediaType} /><AssetStatusBadge status={asset.status} /></span>
      </span>
      <span className="text-right text-[11px] text-muted-foreground">
        <span className="block font-medium text-primary">{asset.fileName}</span>
        <span className="mt-1 block">{asset.fileSize}{asset.duration ? ` · ${formatDuration(asset.duration)}` : ""}</span>
      </span>
    </button>
  )
}

function AssetPreview({ asset }: { asset: AssetRecord }) {
  return (
    <>
      <figure className="relative mt-3 aspect-video overflow-hidden rounded-lg border border-border bg-primary">
        <img src={asset.thumbnail} alt={`Preview ${sceneLabel(asset)}`} className="h-full w-full object-cover" />
        {asset.mediaType === "video" && (
          <span className="absolute inset-0 grid place-items-center bg-primary/5">
            <span className="grid size-12 place-items-center rounded-full border border-white/75 bg-primary/45 text-white backdrop-blur-sm">
              <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" />
            </span>
          </span>
        )}
      </figure>
      {asset.mediaType === "video" && (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" aria-label="Phát preview" className="grid size-9 shrink-0 place-items-center rounded-full border border-input bg-surface text-primary hover:bg-muted">
            <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
          </button>
          <span className="text-[11px] tabular-nums text-muted-foreground">0:00 / {formatDuration(asset.duration)}</span>
          <span className="relative h-1.5 flex-1 rounded-full bg-muted"><span className="absolute left-0 top-0 size-1.5 rounded-full bg-accent" /></span>
          <Volume2 aria-hidden="true" className="size-4 text-primary" />
          <Maximize2 aria-hidden="true" className="size-4 text-primary" />
        </div>
      )}
    </>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.25rem_minmax(0,1fr)] gap-3 border-t border-border py-2.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-primary">{children}</dd>
    </div>
  )
}

function AssetDetail({
  asset,
  index,
  total,
  onClose,
  onDelete,
  onDownload,
  onNext,
  onPrevious,
  onRegenerate,
}: {
  asset: AssetRecord
  index: number
  total: number
  onClose: () => void
  onDelete: () => void
  onDownload: () => void
  onNext: () => void
  onPrevious: () => void
  onRegenerate: () => void
}) {
  const [promptOpen, setPromptOpen] = useState(false)

  return (
    <aside className="rounded-lg border border-border bg-surface p-4 shadow-panel" aria-labelledby="asset-detail-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileImage aria-hidden="true" className="size-[18px] text-primary" />
          <h2 id="asset-detail-title" className="text-section-title text-primary">Chi tiết asset</h2>
        </div>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Asset trước" disabled={index === 0} onClick={onPrevious}><ChevronLeft aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Asset tiếp theo" disabled={index === total - 1} onClick={onNext}><ChevronRight aria-hidden="true" /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng chi tiết asset" onClick={onClose}><X aria-hidden="true" /></Button>
        </div>
      </div>

      <AssetPreview asset={asset} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-base font-bold text-primary">{sceneLabel(asset)}</h3>
          <AssetStatusBadge status={asset.status} />
        </div>
        {asset.duration && <Badge variant="progress"><Clock3 aria-hidden="true" className="size-3" />{formatDuration(asset.duration)}</Badge>}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{asset.description}</p>

      <dl className="mt-3">
        <DetailRow label="Loại media"><MediaBadge mediaType={asset.mediaType} /></DetailRow>
        <DetailRow label="Loại cảnh"><Badge variant="lavender">{asset.sceneType}</Badge></DetailRow>
        <DetailRow label="Scene">
          <a href={`${window.location.pathname}?episodeWorkspace=scenes&episode=peaceful-moments#episodes`} className="inline-flex items-center gap-1 font-semibold text-info hover:underline">
            {sceneLabel(asset)} <span aria-hidden="true">↗</span>
          </a>
        </DetailRow>
        <DetailRow label="Prompt đã dùng">
          <button type="button" onClick={() => setPromptOpen((value) => !value)} className="inline-flex items-center gap-1.5 font-semibold text-info hover:underline">
            <Copy aria-hidden="true" className="size-3.5" />{promptOpen ? "Ẩn prompt" : "Xem prompt"}
          </button>
        </DetailRow>
        {promptOpen && (
          <div className="rounded-md bg-muted/55 px-3 py-2 text-[11px] leading-4 text-muted-foreground">{asset.prompt}</div>
        )}
        <DetailRow label="Ngày tạo"><span className="inline-flex items-center gap-2 tabular-nums"><Clock3 aria-hidden="true" className="size-4" />{dateTimeFormatter.format(new Date(asset.createdAt))}</span></DetailRow>
        <DetailRow label="File">
          <span className="block truncate font-medium">{asset.fileName}</span>
          <span className="mt-1 block text-[11px] text-muted-foreground">{asset.fileSize} · {asset.dimensions}{asset.duration ? ` · ${asset.duration}s` : ""}</span>
        </DetailRow>
      </dl>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onDownload}><Download aria-hidden="true" />Tải xuống</Button>
        <Button type="button" variant="outline" size="sm" onClick={onRegenerate}><RefreshCw aria-hidden="true" />Tạo lại</Button>
        <Button type="button" variant="outline" size="sm" className="border-danger/25 text-danger hover:bg-danger-soft" onClick={onDelete}><Trash2 aria-hidden="true" />Xóa</Button>
      </div>
    </aside>
  )
}

function EmptyAssetDetail() {
  return (
    <aside className="grid min-h-[32rem] place-items-center rounded-lg border border-border bg-surface p-6 text-center shadow-panel">
      <div>
        <ImageIcon aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-3 text-sm font-bold text-primary">Chọn một asset</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Chọn asset trong thư viện để xem preview và metadata.</p>
      </div>
    </aside>
  )
}

function EpisodeAssetsTab({ exportRequest }: { exportRequest: number }) {
  const [assets, setAssets] = useState<AssetRecord[]>(initialAssets)
  const [selectedId, setSelectedId] = useState(initialAssets[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [mediaType, setMediaType] = useState<"all" | AssetMediaType>("all")
  const [status, setStatus] = useState<"all" | AssetStatus>("all")
  const [sort, setSort] = useState<AssetSort>("scene-asc")
  const [view, setView] = useState<AssetView>("grid")
  const [notice, setNotice] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)

  const selectedAsset = assets.find((asset) => asset.id === selectedId)
  const selectedIndex = selectedAsset ? assets.findIndex((asset) => asset.id === selectedAsset.id) : -1

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    const result = assets.filter((asset) => {
      const matchesQuery = !normalizedQuery || [asset.sceneName, asset.description, asset.fileName].some((value) => value.toLocaleLowerCase("vi").includes(normalizedQuery))
      return matchesQuery && (mediaType === "all" || asset.mediaType === mediaType) && (status === "all" || asset.status === status)
    })
    if (sort === "created") return [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (sort === "status") return [...result].sort((a, b) => a.status.localeCompare(b.status, "vi"))
    return [...result].sort((a, b) => a.sceneNumber - b.sceneNumber || a.id.localeCompare(b.id))
  }, [assets, mediaType, query, sort, status])

  useEffect(() => {
    if (exportRequest === 0) return
    setNotice(`Đã chuẩn bị gói xuất cho ${assets.filter((asset) => asset.status === "ready").length} asset đã tạo (mock).`)
  }, [assets, exportRequest])

  function addAsset() {
    const nextNumber = assets.length + 1
    const asset: AssetRecord = {
      id: `asset-new-${Date.now()}`,
      sceneId: "scene-01",
      sceneName: "Hook",
      sceneNumber: 1,
      sceneType: "MAIN_CHARACTER",
      description: "Asset mới chưa có media",
      mediaType: "image",
      status: "waiting",
      thumbnail: thumbnails[0],
      prompt: "Prompt mock cho asset mới.",
      fileName: `asset_moi_${nextNumber}.png`,
      fileSize: "—",
      dimensions: "1920×1080",
      createdAt: new Date().toISOString(),
    }
    setAssets((current) => [asset, ...current])
    setSelectedId(asset.id)
    setQuery("")
    setMediaType("all")
    setStatus("all")
    setSort("created")
    setNotice("Đã thêm một asset nháp vào bộ nhớ tạm.")
  }

  function generateBatch() {
    const waitingCount = assets.filter((asset) => asset.status === "waiting").length
    setAssets((current) => current.map((asset) => asset.status === "waiting" ? { ...asset, status: "generating" } : asset))
    setNotice(waitingCount ? `Đã đưa ${waitingCount} asset vào trạng thái đang tạo (mock).` : "Không có asset đang chờ tạo.")
  }

  function regenerateAsset() {
    if (!selectedAsset) return
    setAssets((current) => current.map((asset) => asset.id === selectedAsset.id ? { ...asset, status: "generating" } : asset))
    setNotice(`${sceneLabel(selectedAsset)} đã chuyển sang trạng thái đang tạo (mock).`)
  }

  function downloadAsset() {
    if (!selectedAsset) return
    const anchor = document.createElement("a")
    anchor.href = selectedAsset.thumbnail
    anchor.download = selectedAsset.fileName
    anchor.click()
    setNotice(`Đã bắt đầu tải ${selectedAsset.fileName}.`)
  }

  function deleteAsset() {
    if (!selectedAsset) return
    const remaining = assets.filter((asset) => asset.id !== selectedAsset.id)
    setAssets(remaining)
    setSelectedId(remaining[Math.min(selectedIndex, remaining.length - 1)]?.id ?? "")
    setNotice(`Đã xóa ${selectedAsset.fileName} khỏi bộ nhớ tạm.`)
    setDeleteOpen(false)
  }

  return (
    <>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(23rem,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-panel" aria-labelledby="asset-library-title">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <Boxes aria-hidden="true" className="size-5 text-primary" />
                <h2 id="asset-library-title" className="text-base font-bold text-primary">Thư viện asset ({assets.length})</h2>
              </div>
              <p className="mt-0.5 pl-[30px] text-[11px] text-muted-foreground">Quản lý hình ảnh và video được tạo từ các cảnh.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={generateBatch}><Sparkles aria-hidden="true" />Tạo media hàng loạt</Button>
              <Button type="button" variant="accent" onClick={addAsset}><Plus aria-hidden="true" />Thêm asset</Button>
            </div>
          </div>

          <div className="asset-toolbar grid gap-2 border-b border-border bg-background/25 p-3 md:grid-cols-2">
            <SearchField label="Tìm asset" value={query} placeholder="Tìm asset, tên cảnh, mô tả…" onChange={(event) => setQuery(event.target.value)} />
            <Select label="Lọc loại media" value={mediaType} onChange={(event) => setMediaType(event.target.value as "all" | AssetMediaType)}>
              <option value="all">Tất cả loại</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </Select>
            <Select label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value as "all" | AssetStatus)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="ready">Đã tạo</option>
              <option value="generating">Đang tạo</option>
              <option value="waiting">Chờ tạo</option>
            </Select>
            <Select label="Sắp xếp asset" value={sort} onChange={(event) => setSort(event.target.value as AssetSort)}>
              <option value="scene-asc">Sắp xếp: Cảnh ↑</option>
              <option value="created">Mới tạo gần đây</option>
              <option value="status">Theo trạng thái</option>
            </Select>
            <div className="grid grid-cols-2 rounded-md border border-input bg-surface p-0.5" aria-label="Kiểu hiển thị">
              <button type="button" aria-label="Xem dạng lưới" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={cn("grid h-[30px] place-items-center rounded text-muted-foreground", view === "grid" && "bg-info-soft text-primary shadow-sm")}><LayoutGrid aria-hidden="true" className="size-4" /></button>
              <button type="button" aria-label="Xem dạng danh sách" aria-pressed={view === "list"} onClick={() => setView("list")} className={cn("grid h-[30px] place-items-center rounded text-muted-foreground", view === "list" && "bg-info-soft text-primary shadow-sm")}><ListIcon aria-hidden="true" className="size-4" /></button>
            </div>
          </div>

          {notice && (
            <div role="status" className="flex items-center justify-between gap-3 border-b border-info/10 bg-info-soft px-3 py-2 text-[11px] text-info">
              <span>{notice}</span>
              <button type="button" aria-label="Ẩn thông báo" onClick={() => setNotice("")} className="shrink-0 rounded p-0.5 hover:bg-info/10"><X aria-hidden="true" className="size-3.5" /></button>
            </div>
          )}

          <div className="max-h-[620px] overflow-y-auto p-3">
            {filteredAssets.length ? view === "grid" ? (
              <div className="asset-grid grid gap-3">
                {filteredAssets.map((asset) => <AssetCard key={asset.id} asset={asset} selected={asset.id === selectedId} onSelect={() => setSelectedId(asset.id)} />)}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                {filteredAssets.map((asset) => <AssetListRow key={asset.id} asset={asset} selected={asset.id === selectedId} onSelect={() => setSelectedId(asset.id)} />)}
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center text-center">
                <div>
                  <PackageOpen aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-bold text-primary">Không tìm thấy asset</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Thử đổi từ khóa hoặc bộ lọc.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {selectedAsset ? (
          <AssetDetail
            asset={selectedAsset}
            index={selectedIndex}
            total={assets.length}
            onClose={() => setSelectedId("")}
            onPrevious={() => setSelectedId(assets[selectedIndex - 1]?.id ?? selectedAsset.id)}
            onNext={() => setSelectedId(assets[selectedIndex + 1]?.id ?? selectedAsset.id)}
            onDownload={downloadAsset}
            onRegenerate={regenerateAsset}
            onDelete={() => setDeleteOpen(true)}
          />
        ) : <EmptyAssetDetail />}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xóa asset này?"
        description="Asset sẽ bị xóa khỏi danh sách mock của phiên hiện tại. Thao tác chưa ảnh hưởng đến file thật."
        cancelLabel="Hủy"
        confirmLabel="Xóa asset"
        onConfirm={deleteAsset}
      />
    </>
  )
}

export { EpisodeAssetsTab }
