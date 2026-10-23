import { ChevronRight, Plus, Search, SlidersHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type CollectionSection = "Tập phim" | "Kịch bản" | "Prompt mẫu"

const collectionContent = {
  "Tập phim": {
    eyebrow: "Thư viện nội dung",
    description: "Tổ chức tập phim từ ý tưởng đầu tiên đến khi sẵn sàng sản xuất.",
    action: "Tạo tập phim",
    count: "6 tập phim",
    columns: ["Chủ đề", "Trạng thái", "Cập nhật"],
    rows: [
      ["Vì sao ta luôn trì hoãn việc quan trọng?", "Tâm lý học hành vi · 11 cảnh", "Đang biên tập", "12 phút trước"],
      ["Hiệu ứng cánh bướm trong đời sống", "Khoa học thường thức · 9 cảnh", "Chờ duyệt", "Hôm qua, 21:40"],
      ["Điều gì xảy ra khi ta ngủ?", "Sức khỏe · 12 cảnh", "Kịch bản nháp", "20 tháng 10"],
      ["Những thành phố biến mất dưới biển", "Lịch sử · Chưa có cảnh", "Mới tạo", "18 tháng 10"],
    ],
  },
  "Kịch bản": {
    eyebrow: "Biên tập nội dung",
    description: "Soạn, sắp xếp và duyệt từng cảnh trước khi lên kế hoạch media.",
    action: "Tạo kịch bản",
    count: "15 cảnh đang soạn",
    columns: ["Thuộc tập", "Trạng thái", "Cập nhật"],
    rows: [
      ["Cảnh 08 · Khoảnh khắc trì hoãn", "Tập 06 · 146 từ", "Đang biên tập", "12 phút trước"],
      ["Cảnh 04 · Chuỗi phản ứng nhỏ", "Tập 05 · 118 từ", "Chờ duyệt", "Hôm qua, 21:40"],
      ["Cảnh 05 · Hai phút đầu tiên", "Tập 06 · 92 từ", "Đã duyệt", "Hôm qua, 18:15"],
      ["Cảnh 03 · Giấc ngủ REM", "Tập 07 · 134 từ", "Bản nháp", "20 tháng 10"],
    ],
  },
  "Prompt mẫu": {
    eyebrow: "Thư viện sáng tạo",
    description: "Giữ cấu trúc brief nhất quán cho các chủ đề và định dạng nội dung.",
    action: "Tạo prompt mẫu",
    count: "12 prompt mẫu",
    columns: ["Mục đích", "Phiên bản", "Cập nhật"],
    rows: [
      ["Kịch bản giải thích 8–10 phút", "Video dài · Giáo dục", "v4 · Đang dùng", "21 tháng 10"],
      ["Mở đầu tạo tò mò", "Hook · 3 biến", "v2 · Đang dùng", "19 tháng 10"],
      ["Mô tả cảnh điện ảnh", "Visual prompt · 6 biến", "v3 · Đang dùng", "16 tháng 10"],
      ["Kiểm tra tính nhất quán", "Review · Kịch bản", "v1 · Bản nháp", "12 tháng 10"],
    ],
  },
} satisfies Record<
  CollectionSection,
  {
    eyebrow: string
    description: string
    action: string
    count: string
    columns: [string, string, string]
    rows: [string, string, string, string][]
  }
>

function statusVariant(status: string) {
  if (status.includes("Đã duyệt") || status.includes("Đang dùng")) return "success" as const
  if (status.includes("Chờ") || status.includes("Mới")) return "attention" as const
  if (status.includes("Đang")) return "progress" as const
  return "neutral" as const
}

export function WorkspaceCollection({ section }: { section: CollectionSection }) {
  const content = collectionContent[section]

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent-strong">
            <span className="h-px w-5 bg-accent" />
            {content.eyebrow}
          </p>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-[2rem]">
            {section}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{content.description}</p>
        </div>
        <Button variant="accent" size="lg">
          <Plus />
          {content.action}
        </Button>
      </section>

      <section className="mt-8" aria-label={`Danh sách ${section.toLocaleLowerCase("vi")}`}>
        <div className="flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label={`Tìm trong ${section.toLocaleLowerCase("vi")}`}
              placeholder={`Tìm ${section.toLocaleLowerCase("vi")}...`}
              className="h-9 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/40 focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="outline" size="sm">
              <SlidersHorizontal />
              Bộ lọc
            </Button>
            <span className="ml-2 text-xs font-semibold text-muted-foreground">{content.count}</span>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_150px_130px_24px] gap-5 border-b border-border bg-muted/35 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>Tên</span>
            <span>{content.columns[0]}</span>
            <span>{content.columns[1]}</span>
            <span>{content.columns[2]}</span>
            <span />
          </div>
          {content.rows.map(([title, context, status, updated], index) => (
            <button
              type="button"
              key={title}
              className="group grid w-full grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-3 border-b border-border px-4 py-4 text-left outline-none last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/40 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_150px_130px_24px] md:gap-5 md:px-5"
            >
              <span className="font-mono text-[11px] font-bold text-muted-foreground md:hidden">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground md:hidden">{context}</span>
              </span>
              <span className="hidden truncate text-xs text-muted-foreground md:block">{context}</span>
              <Badge variant={statusVariant(status)} className="hidden md:inline-flex">
                {status}
              </Badge>
              <span className="hidden text-xs text-muted-foreground md:block">{updated}</span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Dữ liệu mẫu để duyệt UI · Tìm kiếm, bộ lọc và thao tác sẽ được triển khai trong Phase 1.
        </p>
      </section>
    </div>
  )
}

export type { CollectionSection }
