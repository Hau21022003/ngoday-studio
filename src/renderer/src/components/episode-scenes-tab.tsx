import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clipboard,
  Clapperboard,
  Copy,
  FileJson,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Info,
  ListFilter,
  MoreHorizontal,
  Save,
  Sparkles,
  Upload,
  Video,
  X,
} from "lucide-react"
import { useMemo, useState, type ChangeEvent, type DragEvent } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type SceneStatus = "approved" | "draft" | "in-progress"
type SceneType = "B_ROLL" | "ENVIRONMENT" | "MAIN_CHARACTER" | "MOTION_GRAPHIC" | "SCIENTIFIC_VISUALIZATION"
type MediaType = "image" | "video"
type SceneSort = "manual" | "title" | "updated"

type SceneRecord = {
  id: string
  imageDescription: string
  mediaType: MediaType
  narration: string
  notes: string
  sceneType: SceneType
  status: SceneStatus
  thumbnail: string
  title: string
  updatedAt: string
}

const sceneTypes = {
  B_ROLL: { label: "B_ROLL", variant: "neutral" },
  ENVIRONMENT: { label: "ENVIRONMENT", variant: "success" },
  MAIN_CHARACTER: { label: "MAIN_CHARACTER", variant: "danger" },
  MOTION_GRAPHIC: { label: "MOTION_GRAPHIC", variant: "warning" },
  SCIENTIFIC_VISUALIZATION: { label: "SCIENTIFIC_VISUALIZATION", variant: "lavender" },
} as const

const statuses = {
  approved: { label: "Đã duyệt", variant: "success", icon: BadgeCheck },
  draft: { label: "Draft", variant: "neutral", icon: FileText },
  "in-progress": { label: "Đang làm", variant: "info", icon: Clapperboard },
} as const

const thumbnails = [
  "/episode-thumbnails/peaceful-moments.png",
  "/episode-thumbnails/dream-doorway.png",
  "/episode-thumbnails/dream-meditation.png",
  "/episode-thumbnails/dream-sleep.png",
  "/episode-thumbnails/dream-portal.png",
] as const

const initialScenes: SceneRecord[] = [
  {
    id: "scene-01",
    title: "Hook",
    narration: "Có bao giờ bạn tự hỏi vì sao những khoảnh khắc bình dị lại khiến ta nhớ mãi?",
    imageDescription: "Một buổi chiều yên bình, cậu bé ngồi trên bậc thềm nhìn ra thung lũng cùng chú mèo.",
    sceneType: "MAIN_CHARACTER",
    mediaType: "image",
    notes: "Mở đầu chậm, giữ khoảng lặng 2 giây trước lời dẫn.",
    status: "in-progress",
    thumbnail: thumbnails[0],
    updatedAt: "2026-10-24T14:30:00+07:00",
  },
  {
    id: "scene-02",
    title: "Mở đầu",
    narration: "Buổi sáng ở ngôi làng bắt đầu bằng tiếng gió nhẹ và ánh nắng len qua mái hiên.",
    imageDescription: "Con đường nhỏ giữa những ngôi nhà gỗ, đèn lồng còn sáng trong nắng sớm.",
    sceneType: "ENVIRONMENT",
    mediaType: "image",
    notes: "Tông màu ấm, chuyển cảnh chậm.",
    status: "draft",
    thumbnail: thumbnails[0],
    updatedAt: "2026-10-24T13:10:00+07:00",
  },
  {
    id: "scene-03",
    title: "Giải thích",
    narration: "Ánh sáng mặt trời len qua kẽ lá, tạo nên những vệt sáng ấm áp, gợi cảm giác bình yên và kết nối với thiên nhiên.",
    imageDescription: "Cận cảnh những tán lá xanh, ánh nắng chiếu xuyên qua kẽ lá, tạo hiệu ứng bokeh, không khí trong lành và ấm áp.",
    sceneType: "SCIENTIFIC_VISUALIZATION",
    mediaType: "image",
    notes: "Tập trung vào ánh sáng tự nhiên, màu sắc ấm, không khí nhẹ nhàng, tích cực.",
    status: "approved",
    thumbnail: thumbnails[2],
    updatedAt: "2026-10-24T15:45:00+07:00",
  },
  {
    id: "scene-04",
    title: "Ví dụ thực tế",
    narration: "Một chú mèo nằm sưởi nắng cũng nhắc ta rằng bình yên đôi khi chỉ là biết dừng lại.",
    imageDescription: "Chú mèo bước qua thảm cỏ vàng, ánh nắng tạo viền sáng mềm quanh bộ lông.",
    sceneType: "ENVIRONMENT",
    mediaType: "video",
    notes: "Chuyển động máy quay ngang, tốc độ chậm.",
    status: "in-progress",
    thumbnail: thumbnails[1],
    updatedAt: "2026-10-24T12:40:00+07:00",
  },
  {
    id: "scene-05",
    title: "Phân tích sâu hơn",
    narration: "Khoa học cho thấy những khoảng nghỉ ngắn giúp não bộ phục hồi sự chú ý và cảm xúc.",
    imageDescription: "Bàn làm việc với sổ tay, tách trà và biểu đồ tối giản minh họa nhịp nghỉ ngơi.",
    sceneType: "MOTION_GRAPHIC",
    mediaType: "image",
    notes: "Dùng icon đơn giản, tránh quá nhiều chữ.",
    status: "draft",
    thumbnail: thumbnails[4],
    updatedAt: "2026-10-24T11:05:00+07:00",
  },
  {
    id: "scene-06",
    title: "Kết luận",
    narration: "Bình yên không ở đâu xa; nó nằm trong cách ta nhìn và trân trọng những điều nhỏ bé mỗi ngày.",
    imageDescription: "Toàn cảnh ngôi làng lúc hoàng hôn, cậu bé và chú mèo ngồi cạnh nhau trên hiên nhà.",
    sceneType: "MAIN_CHARACTER",
    mediaType: "video",
    notes: "Kết bằng khung hình rộng và nhạc nhỏ dần.",
    status: "approved",
    thumbnail: thumbnails[0],
    updatedAt: "2026-10-24T16:03:00+07:00",
  },
  {
    id: "scene-07",
    title: "Nhịp sống buổi sớm",
    narration: "Khi thành phố còn vội vã, ngôi làng thức dậy theo nhịp riêng của mình.",
    imageDescription: "Khói bếp mỏng bay trên mái ngói, người dân mở cửa đón nắng đầu ngày.",
    sceneType: "B_ROLL",
    mediaType: "video",
    notes: "Dùng làm cảnh nối.",
    status: "draft",
    thumbnail: thumbnails[0],
    updatedAt: "2026-10-23T17:20:00+07:00",
  },
  {
    id: "scene-08",
    title: "Một phút lắng lại",
    narration: "Chỉ một phút hít thở sâu cũng đủ để ta nghe rõ hơn những gì đang diễn ra bên trong.",
    imageDescription: "Nhân vật ngồi bên hồ tĩnh lặng, phản chiếu bầu trời xanh tím.",
    sceneType: "MAIN_CHARACTER",
    mediaType: "image",
    notes: "Không chèn chữ lên hình.",
    status: "approved",
    thumbnail: thumbnails[3],
    updatedAt: "2026-10-23T16:15:00+07:00",
  },
  {
    id: "scene-09",
    title: "Âm thanh quanh ta",
    narration: "Tiếng lá, tiếng chim và tiếng bước chân tạo thành bản nhạc quen thuộc của đời sống.",
    imageDescription: "Cành cây lay nhẹ, chim nhỏ đậu trên mái ngói trong nắng sớm.",
    sceneType: "ENVIRONMENT",
    mediaType: "video",
    notes: "Ưu tiên ambience tự nhiên.",
    status: "in-progress",
    thumbnail: thumbnails[1],
    updatedAt: "2026-10-23T15:00:00+07:00",
  },
  {
    id: "scene-10",
    title: "Góc nhìn khoa học",
    narration: "Những tín hiệu dịu nhẹ từ thiên nhiên giúp hệ thần kinh chuyển sang trạng thái thư giãn.",
    imageDescription: "Minh họa tối giản về nhịp tim ổn định và sóng não thư giãn.",
    sceneType: "SCIENTIFIC_VISUALIZATION",
    mediaType: "image",
    notes: "Giữ cùng bảng màu với episode.",
    status: "draft",
    thumbnail: thumbnails[4],
    updatedAt: "2026-10-23T14:00:00+07:00",
  },
  {
    id: "scene-11",
    title: "Khoảnh khắc sẻ chia",
    narration: "Một cuộc trò chuyện ngắn và chân thành có thể khiến ngày dài trở nên nhẹ hơn.",
    imageDescription: "Hai nhân vật trò chuyện bên tách trà dưới hiên nhà, ánh sáng dịu.",
    sceneType: "MAIN_CHARACTER",
    mediaType: "image",
    notes: "Biểu cảm tự nhiên, không nhìn máy quay.",
    status: "draft",
    thumbnail: thumbnails[1],
    updatedAt: "2026-10-23T12:00:00+07:00",
  },
  {
    id: "scene-12",
    title: "Outro",
    narration: "Hãy thử chậm lại hôm nay, và kể cho chúng tôi về điều nhỏ bé khiến bạn mỉm cười.",
    imageDescription: "Bầu trời hoàng hôn trên thung lũng, khoảng trống ở giữa dành cho end card.",
    sceneType: "B_ROLL",
    mediaType: "video",
    notes: "Chừa safe zone cho logo và CTA.",
    status: "approved",
    thumbnail: thumbnails[0],
    updatedAt: "2026-10-23T10:30:00+07:00",
  },
]

const jsonExample = `{
  "scenes": [
    {
      "title": "Cảnh mở đầu",
      "narration": "Một buổi sáng yên bình bắt đầu...",
      "imageDescription": "Toàn cảnh ngôi làng trong nắng sớm",
      "sceneType": "ENVIRONMENT",
      "mediaType": "image",
      "notes": "Chuyển cảnh chậm"
    }
  ]
}`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key] as string
  }
  return ""
}

function parseImportedScenes(value: string): SceneRecord[] {
  const parsed: unknown = JSON.parse(value)
  const rows = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.scenes)
      ? parsed.scenes
      : null

  if (!rows?.length) throw new Error("JSON cần chứa mảng scenes có ít nhất một cảnh.")

  return rows.map((row, index) => {
    if (!isRecord(row)) throw new Error(`Scene ${index + 1} không đúng định dạng object.`)
    const title = stringValue(row, "title", "name")
    const narration = stringValue(row, "narration", "voiceOver", "voice_over")
    const imageDescription = stringValue(row, "imageDescription", "image_description", "visualDescription")
    if (!title || !narration || !imageDescription) {
      throw new Error(`Scene ${index + 1} cần có title, narration và imageDescription.`)
    }

    const rawType = stringValue(row, "sceneType", "scene_type").toUpperCase()
    const sceneType = rawType in sceneTypes ? (rawType as SceneType) : "ENVIRONMENT"
    const mediaType: MediaType = stringValue(row, "mediaType", "media_type").toLowerCase() === "video" ? "video" : "image"
    const rawStatus = stringValue(row, "status").toLowerCase()
    const status: SceneStatus = rawStatus === "approved" ? "approved" : "draft"

    return {
      id: globalThis.crypto?.randomUUID?.() ?? `imported-${Date.now()}-${index}`,
      title,
      narration,
      imageDescription,
      sceneType,
      mediaType,
      notes: stringValue(row, "notes"),
      status,
      thumbnail: thumbnails[index % thumbnails.length] ?? thumbnails[0],
      updatedAt: new Date().toISOString(),
    }
  })
}

function SceneTypeBadge({ value }: { value: SceneType }) {
  const presentation = sceneTypes[value]
  return <Badge variant={presentation.variant}>{presentation.label}</Badge>
}

function MediaBadge({ value }: { value: MediaType }) {
  const Icon = value === "image" ? ImageIcon : Video
  return (
    <Badge variant={value === "image" ? "info" : "lavender"}>
      <Icon aria-hidden="true" className="size-3" />
      {value === "image" ? "Image" : "Video"}
    </Badge>
  )
}

function SceneStatusBadge({ value }: { value: SceneStatus }) {
  const presentation = statuses[value]
  const Icon = presentation.icon
  return (
    <Badge variant={presentation.variant} className="px-2.5 py-1">
      <Icon aria-hidden="true" className="size-3" />
      {presentation.label}
    </Badge>
  )
}

function SceneRow({
  scene,
  index,
  selected,
  reordering,
  isFirst,
  isLast,
  onSelect,
  onMove,
  onDragStart,
  onDrop,
}: {
  scene: SceneRecord
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
      role="option"
      aria-selected={selected}
      tabIndex={0}
      draggable={reordering}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      onDragStart={onDragStart}
      onDragOver={(event) => reordering && event.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group grid min-h-[88px] grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2.5 outline-none transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30",
        selected ? "bg-selected" : "bg-surface hover:bg-muted/35",
        reordering && "cursor-grab active:cursor-grabbing",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 place-items-center rounded-[4px] border",
          selected ? "border-accent bg-accent text-white" : "border-border-strong bg-surface",
        )}
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>

      <div className="flex items-center gap-1.5 text-muted-foreground">
        <GripVertical aria-hidden="true" className="size-4" />
        <span className="w-6 text-center text-xs font-bold tabular-nums text-primary">{String(index + 1).padStart(2, "0")}</span>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <img
          src={scene.thumbnail}
          alt=""
          width={120}
          height={72}
          draggable={false}
          className="h-[62px] w-[104px] shrink-0 rounded-md border border-border object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-primary">{scene.title}</p>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden">
            <SceneTypeBadge value={scene.sceneType} />
            <MediaBadge value={scene.mediaType} />
          </div>
          <p className="mt-1 line-clamp-1 text-xs leading-4 text-muted-foreground">{scene.narration}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-1" onClick={(event) => event.stopPropagation()}>
        {reordering ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              aria-label={`Đưa ${scene.title} lên trên`}
              disabled={isFirst}
              onClick={() => onMove(-1)}
              className="grid size-6 place-items-center rounded border border-input bg-surface text-muted-foreground hover:text-primary disabled:opacity-30"
            >
              <ArrowUp aria-hidden="true" className="size-3" />
            </button>
            <button
              type="button"
              aria-label={`Đưa ${scene.title} xuống dưới`}
              disabled={isLast}
              onClick={() => onMove(1)}
              className="grid size-6 place-items-center rounded border border-input bg-surface text-muted-foreground hover:text-primary disabled:opacity-30"
            >
              <ArrowDown aria-hidden="true" className="size-3" />
            </button>
          </div>
        ) : (
          <SceneStatusBadge value={scene.status} />
        )}
        <button
          type="button"
          aria-label={`Thao tác cho ${scene.title}`}
          className="grid size-8 place-items-center rounded-md border border-input bg-surface text-primary hover:bg-muted"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  )
}

function SceneEditor({
  scene,
  index,
  total,
  onChange,
  onPrevious,
  onNext,
}: {
  scene: SceneRecord
  index: number
  total: number
  onChange: (patch: Partial<SceneRecord>) => void
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel" aria-labelledby="scene-detail-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText aria-hidden="true" className="size-[18px] text-primary" />
          <h2 id="scene-detail-title" className="text-section-title text-primary">Chi tiết cảnh</h2>
        </div>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Cảnh trước" disabled={index === 0} onClick={onPrevious}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Cảnh tiếp theo" disabled={index === total - 1} onClick={onNext}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold tracking-[-0.015em] text-primary">
          {String(index + 1).padStart(2, "0")}. {scene.title}
        </h3>
        <SceneStatusBadge value={scene.status} />
      </div>

      <div className="mt-3 space-y-2.5">
        <label className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-[7.25rem_minmax(0,1fr)] sm:items-start">
          <span className="pt-2">Narration / Lời dẫn</span>
          <Textarea
            value={scene.narration}
            className="min-h-[76px] resize-none text-xs leading-[1.45]"
            onChange={(event) => onChange({ narration: event.target.value })}
          />
        </label>
        <label className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-[7.25rem_minmax(0,1fr)] sm:items-start">
          <span className="pt-2">Mô tả hình ảnh</span>
          <Textarea
            value={scene.imageDescription}
            className="min-h-[76px] resize-none text-xs leading-[1.45]"
            onChange={(event) => onChange({ imageDescription: event.target.value })}
          />
        </label>
        <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-[7.25rem_minmax(0,1fr)] sm:items-center">
          <span>Loại cảnh</span>
          <Select
            label="Loại cảnh"
            value={scene.sceneType}
            className="h-9 text-xs font-semibold"
            onChange={(event) => onChange({ sceneType: event.target.value as SceneType })}
          >
            {(Object.keys(sceneTypes) as SceneType[]).map((value) => (
              <option key={value} value={value}>{sceneTypes[value].label}</option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-[7.25rem_minmax(0,1fr)] sm:items-center">
          <span>Media</span>
          <Select
            label="Media type"
            value={scene.mediaType}
            className="h-9 text-xs font-semibold"
            onChange={(event) => onChange({ mediaType: event.target.value as MediaType })}
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </Select>
        </div>
        <label className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-[7.25rem_minmax(0,1fr)] sm:items-start">
          <span className="pt-2">Ghi chú</span>
          <Textarea
            value={scene.notes}
            className="min-h-[62px] resize-none text-xs leading-[1.45]"
            onChange={(event) => onChange({ notes: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-border pt-3">
        <Button type="button" variant="outline" onClick={() => onChange({ status: "draft" })}>
          <Save aria-hidden="true" />Lưu nháp
        </Button>
        <Button type="button" variant="accent" onClick={() => onChange({ status: "approved" })}>
          <Check aria-hidden="true" />{scene.status === "approved" ? "Đã duyệt" : "Duyệt cảnh"}
        </Button>
      </div>
    </section>
  )
}

function FlowSteps() {
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Quy trình tạo và import Scenes">
      {[
        "Chọn Scene Template",
        "Sao chép prompt",
        "Dùng ChatGPT thủ công",
        "Import JSON kết quả",
      ].map((label, index) => (
        <li key={label} className="flex min-w-0 items-start gap-1.5 text-[10px] leading-[1.25] text-primary">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">{index + 1}</span>
          <span className="pt-0.5 text-pretty">{label}</span>
        </li>
      ))}
    </ol>
  )
}

function CreateScenesCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-panel" aria-labelledby="create-scenes-title">
      <div className="flex items-center gap-2.5">
        <CirclePlus aria-hidden="true" className="size-[18px] text-primary" />
        <h2 id="create-scenes-title" className="text-section-title text-primary">Tạo / Import Scenes</h2>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
        Chọn template, sao chép prompt sang ChatGPT rồi import JSON kết quả để review tại đây.
      </p>
      <FlowSteps />
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Button type="button" variant="accent" onClick={onOpen}>
          <Clipboard aria-hidden="true" />Sao chép prompt
        </Button>
        <Button type="button" variant="outline" onClick={onOpen}>
          <Upload aria-hidden="true" />Import JSON
        </Button>
      </div>
      <div className="mt-2.5 flex items-start gap-2 rounded-md bg-info-soft px-3 py-2 text-[11px] leading-4 text-info">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <p>Ứng dụng không tự gọi AI. Prompt và JSON được chuyển thủ công qua ChatGPT.</p>
      </div>
    </section>
  )
}

function CreateScenesDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (scenes: SceneRecord[], mode: "append" | "replace") => void
}) {
  const [template, setTemplate] = useState("storytelling")
  const [sourceContent, setSourceContent] = useState("")
  const [json, setJson] = useState(jsonExample)
  const [importMode, setImportMode] = useState<"append" | "replace">("append")
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const templateName = template === "documentary" ? "Giải thích khoa học" : template === "shorts" ? "Video ngắn 60 giây" : "Kể chuyện nhẹ nhàng"
  const prompt = `Bạn là biên tập viên video. Hãy tạo danh sách scenes cho episode “Tập 01: Bình yên từ những điều nhỏ bé” bằng Scene Template “${templateName}”.\n\n${sourceContent ? `Nội dung nguồn (chỉ dùng để chia cảnh):\n${sourceContent}\n\n` : ""}Trả về JSON thuần theo schema: { "scenes": [{ "title": string, "narration": string, "imageDescription": string, "sceneType": "MAIN_CHARACTER" | "ENVIRONMENT" | "SCIENTIFIC_VISUALIZATION" | "MOTION_GRAPHIC" | "B_ROLL", "mediaType": "image" | "video", "notes": string }] }. Không thêm markdown hoặc giải thích.`

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setFeedback({ tone: "success", message: "Đã sao chép prompt. Hãy dán vào ChatGPT và mang JSON kết quả quay lại đây." })
    } catch {
      setFeedback({ tone: "error", message: "Không thể truy cập clipboard. Bạn có thể chọn và sao chép prompt thủ công." })
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setJson(reader.result)
        setFeedback(null)
      }
    }
    reader.readAsText(file)
  }

  function importJson() {
    try {
      const importedScenes = parseImportedScenes(json)
      onImport(importedScenes, importMode)
      setFeedback({ tone: "success", message: `Đã import ${importedScenes.length} scene vào bộ nhớ tạm.` })
      onOpenChange(false)
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "JSON không hợp lệ." })
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-primary/28 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in motion-reduce:animate-none" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[81] max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-overlay focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="flex items-center gap-2 text-base font-bold text-primary">
                <Sparkles aria-hidden="true" className="size-5 text-accent" />Tạo / Import Scenes
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-muted-foreground">
                Flow thủ công, không gọi AI và không lưu dữ liệu ra persistence.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">Đóng</span>
            </DialogPrimitive.Close>
          </div>

          <FlowSteps />

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-background/45 p-4" aria-labelledby="prompt-section-title">
              <h3 id="prompt-section-title" className="text-sm font-bold text-primary">1. Chuẩn bị prompt</h3>
              <div className="mt-3 text-xs font-semibold text-primary">
                <p>Scene Template</p>
                <Select label="Scene Template" value={template} className="mt-1.5" onChange={(event) => setTemplate(event.target.value)}>
                  <option value="storytelling">Kể chuyện nhẹ nhàng</option>
                  <option value="documentary">Giải thích khoa học</option>
                  <option value="shorts">Video ngắn 60 giây</option>
                </Select>
              </div>
              <label className="mt-3 block text-xs font-semibold text-primary">
                Nội dung nguồn <span className="font-normal text-muted-foreground">(tùy chọn)</span>
                <Textarea
                  value={sourceContent}
                  className="mt-1.5 min-h-[76px] resize-none text-xs"
                  placeholder="Dán script hoặc nội dung có sẵn để GPT chia thành scene…"
                  onChange={(event) => setSourceContent(event.target.value)}
                />
              </label>
              <label className="mt-3 block text-xs font-semibold text-primary">
                Prompt đã render
                <Textarea readOnly value={prompt} className="mt-1.5 min-h-[126px] resize-none bg-muted/35 font-mono text-[10px] leading-4" />
              </label>
              <Button type="button" variant="accent" className="mt-3 w-full" onClick={copyPrompt}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? "Đã sao chép prompt" : "Sao chép prompt"}
              </Button>
            </section>

            <section className="rounded-lg border border-border bg-background/45 p-4" aria-labelledby="json-section-title">
              <h3 id="json-section-title" className="text-sm font-bold text-primary">2. Import JSON từ ChatGPT</h3>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] leading-4 text-muted-foreground">Dán JSON hoặc chọn file kết quả.</p>
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-surface px-2.5 text-xs font-semibold text-primary hover:bg-muted">
                  <FileJson aria-hidden="true" className="size-3.5" />Chọn file
                  <Input type="file" accept=".json,application/json" className="sr-only" onChange={handleFile} />
                </label>
              </div>
              <Textarea
                aria-label="JSON Scenes"
                value={json}
                spellCheck={false}
                className="mt-2 min-h-[260px] resize-none font-mono text-[10px] leading-4"
                onChange={(event) => {
                  setJson(event.target.value)
                  setFeedback(null)
                }}
              />
              <div className="mt-3 text-xs font-semibold text-primary">
                <p>Cách áp dụng</p>
                <Select label="Cách áp dụng JSON" value={importMode} className="mt-1.5" onChange={(event) => setImportMode(event.target.value as "append" | "replace")}>
                  <option value="append">Thêm vào cuối danh sách</option>
                  <option value="replace">Thay thế danh sách hiện tại</option>
                </Select>
              </div>
              {feedback && (
                <p role="status" className={cn("mt-3 rounded-md px-3 py-2 text-xs", feedback.tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                  {feedback.message}
                </p>
              )}
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={importJson}>
                <Upload aria-hidden="true" />Kiểm tra và import JSON
              </Button>
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function EpisodeScenesTab() {
  const [scenes, setScenes] = useState<SceneRecord[]>(initialScenes)
  const [selectedId, setSelectedId] = useState("scene-03")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | SceneStatus>("all")
  const [sceneType, setSceneType] = useState<"all" | SceneType>("all")
  const [sort, setSort] = useState<SceneSort>("manual")
  const [reordering, setReordering] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [flowOpen, setFlowOpen] = useState(false)

  const selectedScene = scenes.find((scene) => scene.id === selectedId) ?? scenes[0]
  const selectedIndex = selectedScene ? scenes.findIndex((scene) => scene.id === selectedScene.id) : -1

  const filteredScenes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    const result = scenes.filter((scene) => {
      const matchesQuery = !normalizedQuery || [scene.title, scene.narration, scene.imageDescription].some((value) => value.toLocaleLowerCase("vi").includes(normalizedQuery))
      return matchesQuery && (status === "all" || scene.status === status) && (sceneType === "all" || scene.sceneType === sceneType)
    })
    if (sort === "title") return [...result].sort((a, b) => a.title.localeCompare(b.title, "vi"))
    if (sort === "updated") return [...result].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return result
  }, [query, sceneType, scenes, sort, status])

  function updateSelectedScene(patch: Partial<SceneRecord>) {
    if (!selectedScene) return
    setScenes((current) => current.map((scene) => scene.id === selectedScene.id ? { ...scene, ...patch, updatedAt: new Date().toISOString() } : scene))
  }

  function moveScene(sceneId: string, direction: -1 | 1) {
    setScenes((current) => {
      const currentIndex = current.findIndex((scene) => scene.id === sceneId)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(currentIndex, 1)
      if (!moved) return current
      next.splice(nextIndex, 0, moved)
      return next
    })
  }

  function dropScene(targetId: string) {
    if (!draggedId || draggedId === targetId) return
    setScenes((current) => {
      const from = current.findIndex((scene) => scene.id === draggedId)
      const to = current.findIndex((scene) => scene.id === targetId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      if (!moved) return current
      next.splice(to, 0, moved)
      return next
    })
    setDraggedId(null)
  }

  function importScenes(imported: SceneRecord[], mode: "append" | "replace") {
    setScenes((current) => mode === "replace" ? imported : [...current, ...imported])
    setSelectedId(imported[0]?.id ?? selectedId)
    setQuery("")
    setStatus("all")
    setSceneType("all")
    setSort("manual")
  }

  return (
    <>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(23rem,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-panel" aria-labelledby="scene-list-title">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <Clapperboard aria-hidden="true" className="size-5 text-primary" />
                <h2 id="scene-list-title" className="text-base font-bold text-primary">Danh sách cảnh ({scenes.length})</h2>
              </div>
              <p className="mt-0.5 pl-[30px] text-[11px] text-muted-foreground">Quản lý, chỉnh sửa và sắp xếp các cảnh trong tập phim</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="accent" onClick={() => setFlowOpen(true)}>
                <CirclePlus aria-hidden="true" />Tạo / Import Scenes
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-pressed={reordering}
                onClick={() => {
                  setReordering((value) => !value)
                  setSort("manual")
                }}
              >
                <ListFilter aria-hidden="true" />{reordering ? "Xong" : "Sắp xếp"}
              </Button>
            </div>
          </div>

          <div className="scene-toolbar grid gap-2 border-b border-border bg-background/25 p-3 md:grid-cols-2">
            <SearchField label="Tìm kiếm cảnh" value={query} placeholder="Tìm cảnh, lời dẫn…" onChange={(event) => setQuery(event.target.value)} />
            <Select label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value as "all" | SceneStatus)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Draft</option>
              <option value="in-progress">Đang làm</option>
              <option value="approved">Đã duyệt</option>
            </Select>
            <Select label="Lọc loại cảnh" value={sceneType} onChange={(event) => setSceneType(event.target.value as "all" | SceneType)}>
              <option value="all">Tất cả loại cảnh</option>
              {(Object.keys(sceneTypes) as SceneType[]).map((value) => <option key={value} value={value}>{sceneTypes[value].label}</option>)}
            </Select>
            <Select label="Sắp xếp cảnh" value={sort} disabled={reordering} onChange={(event) => setSort(event.target.value as SceneSort)}>
              <option value="manual">Thứ tự thủ công</option>
              <option value="updated">Cập nhật gần nhất</option>
              <option value="title">Tiêu đề A–Z</option>
            </Select>
          </div>

          <div role="listbox" aria-label="Danh sách cảnh" className="max-h-[570px] overflow-y-auto">
            {filteredScenes.length ? filteredScenes.map((scene) => {
              const index = scenes.findIndex((item) => item.id === scene.id)
              return (
                <SceneRow
                  key={scene.id}
                  scene={scene}
                  index={index}
                  selected={scene.id === selectedScene?.id}
                  reordering={reordering}
                  isFirst={index === 0}
                  isLast={index === scenes.length - 1}
                  onSelect={() => setSelectedId(scene.id)}
                  onMove={(direction) => moveScene(scene.id, direction)}
                  onDragStart={(event) => {
                    setDraggedId(scene.id)
                    event.dataTransfer.effectAllowed = "move"
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    dropScene(scene.id)
                  }}
                />
              )
            }) : (
              <div className="grid min-h-64 place-items-center p-6 text-center">
                <div>
                  <Clapperboard aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
                  <p className="mt-2 text-sm font-bold text-primary">Không tìm thấy cảnh</p>
                  <p className="mt-1 text-xs text-muted-foreground">Thử đổi từ khóa hoặc bộ lọc.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-4">
          {selectedScene && (
            <SceneEditor
              scene={selectedScene}
              index={selectedIndex}
              total={scenes.length}
              onChange={updateSelectedScene}
              onPrevious={() => setSelectedId(scenes[selectedIndex - 1]?.id ?? selectedScene.id)}
              onNext={() => setSelectedId(scenes[selectedIndex + 1]?.id ?? selectedScene.id)}
            />
          )}
          <CreateScenesCard onOpen={() => setFlowOpen(true)} />
        </div>
      </div>

      <CreateScenesDialog open={flowOpen} onOpenChange={setFlowOpen} onImport={importScenes} />
    </>
  )
}

export { EpisodeScenesTab }
