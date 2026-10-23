import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Clock3,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const episodes = [
  {
    number: "EP. 06",
    title: "Vì sao ta luôn trì hoãn việc quan trọng?",
    topic: "Tâm lý học hành vi",
    progress: 72,
    scenes: "8 / 11 cảnh duyệt",
    status: "Đang biên tập",
    updated: "12 phút trước",
  },
  {
    number: "EP. 05",
    title: "Hiệu ứng cánh bướm trong đời sống",
    topic: "Khoa học thường thức",
    progress: 38,
    scenes: "4 / 9 cảnh duyệt",
    status: "Chờ duyệt",
    updated: "Hôm qua, 21:40",
  },
]

const plannedEpisodes = [
  {
    order: "07",
    title: "Điều gì xảy ra khi ta ngủ?",
    topic: "Sức khỏe",
    scenes: "12 cảnh",
    state: "Kịch bản nháp",
    badge: "neutral" as const,
  },
  {
    order: "08",
    title: "Những thành phố biến mất dưới biển",
    topic: "Lịch sử",
    scenes: "—",
    state: "Mới tạo",
    badge: "attention" as const,
  },
  {
    order: "09",
    title: "Cách ký ức thay đổi theo thời gian",
    topic: "Tâm lý học",
    scenes: "—",
    state: "Ý tưởng",
    badge: "neutral" as const,
  },
]

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 px-5 py-4 first:pl-0 last:pr-0 sm:border-r sm:border-border sm:last:border-r-0">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

export function WorkspaceOverview() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent-strong">
            <span className="h-px w-5 bg-accent" />
            Thứ Sáu, 23 tháng 10
          </p>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-[2rem]">
            Xưởng sản xuất
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Tiếp tục các tập đang làm và xử lý những cảnh cần duyệt hôm nay.
          </p>
        </div>
        <Button variant="accent" size="lg">
          <Plus />
          Tạo tập phim
        </Button>
      </section>

      <section className="mt-8 grid border-y border-border sm:grid-cols-3" aria-label="Tình hình sản xuất">
        <Stat label="tập đang làm" value="02" note="1 tập cập nhật hôm nay" />
        <Stat label="cảnh chờ duyệt" value="07" note="Tập 05 và Tập 06" />
        <Stat label="prompt mẫu" value="12" note="3 mẫu dùng gần đây" />
      </section>

      <div className="mt-9 grid items-start gap-9 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">Tiếp tục công việc</h2>
              <p className="mt-1 text-xs text-muted-foreground">Các tập được chỉnh sửa gần đây</p>
            </div>
            <Button variant="ghost" size="sm">
              Xem tất cả
              <ArrowRight />
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {episodes.map((episode, index) => (
              <article
                key={episode.number}
                className="group grid gap-5 border-b border-border p-5 transition-colors last:border-b-0 hover:bg-muted/30 md:grid-cols-[minmax(0,1fr)_190px_24px] md:items-center md:p-6"
              >
                <div className="flex min-w-0 gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-background text-[10px] font-extrabold tracking-[0.08em] text-primary">
                    {episode.number}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-foreground">{episode.title}</h3>
                      <Badge variant={index === 0 ? "progress" : "attention"}>{episode.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {episode.topic} <span className="px-1.5 text-border-strong">•</span> {episode.updated}
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-1.5 max-w-72 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${episode.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {episode.scenes}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden grid-cols-4 gap-1 md:grid" aria-label={`Tiến độ ${episode.title}`}>
                  {["Ý tưởng", "Kịch bản", "Cảnh", "Duyệt"].map((step, stepIndex) => (
                    <div key={step} className="text-center">
                      <div
                        className={`mx-auto mb-1.5 grid size-5 place-items-center rounded-full border text-[10px] ${
                          stepIndex < (index === 0 ? 3 : 2)
                            ? "border-primary bg-primary text-primary-foreground"
                            : stepIndex === (index === 0 ? 3 : 2)
                              ? "border-accent bg-accent-soft text-accent-strong"
                              : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {stepIndex < (index === 0 ? 3 : 2) ? <Check className="size-3" /> : stepIndex + 1}
                      </div>
                      <span className="text-[9px] font-semibold text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>
                <ChevronRight className="hidden size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block" />
              </article>
            ))}
          </div>

          <div className="mb-4 mt-9 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">Kế hoạch tập phim</h2>
              <p className="mt-1 text-xs text-muted-foreground">Nội dung đang chờ được phát triển</p>
            </div>
            <Button variant="outline" size="sm">
              <Plus />
              Thêm ý tưởng
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="hidden grid-cols-[56px_minmax(0,1fr)_140px_120px_28px] gap-4 border-b border-border bg-muted/35 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <span>Tập</span>
              <span>Nội dung</span>
              <span>Trạng thái</span>
              <span>Số cảnh</span>
              <span />
            </div>
            {plannedEpisodes.map((episode) => (
              <button
                type="button"
                key={episode.order}
                className="group grid w-full grid-cols-[44px_minmax(0,1fr)_24px] items-center gap-3 border-b border-border px-4 py-4 text-left outline-none last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/40 md:grid-cols-[56px_minmax(0,1fr)_140px_120px_28px] md:gap-4 md:px-5"
              >
                <span className="font-mono text-xs font-bold text-muted-foreground">{episode.order}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{episode.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{episode.topic}</span>
                </span>
                <Badge variant={episode.badge} className="hidden md:inline-flex">
                  {episode.state}
                </Badge>
                <span className="hidden text-xs text-muted-foreground md:block">{episode.scenes}</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>

        <aside className="space-y-8 xl:sticky xl:top-24">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold tracking-tight text-foreground">Cần xử lý</h2>
                <p className="mt-1 text-xs text-muted-foreground">3 việc đang chờ bạn</p>
              </div>
              <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-strong">
                3
              </span>
            </div>
            <div className="divide-y divide-border border-y border-border">
              <button type="button" className="group flex w-full gap-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold leading-5 text-foreground">Duyệt 3 cảnh của Tập 06</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">Cập nhật 12 phút trước</span>
                </span>
                <ChevronRight className="mt-0.5 size-4 text-muted-foreground group-hover:translate-x-0.5" />
              </button>
              <button type="button" className="group flex w-full gap-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold leading-5 text-foreground">Kịch bản Tập 05 có thay đổi</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">So sánh với bản duyệt gần nhất</span>
                </span>
                <ChevronRight className="mt-0.5 size-4 text-muted-foreground group-hover:translate-x-0.5" />
              </button>
              <button type="button" className="group flex w-full gap-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <CircleDot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold leading-5 text-foreground">Bổ sung prompt cho cảnh 04</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">Tập 05 · Cảnh chuyển tiếp</span>
                </span>
                <ChevronRight className="mt-0.5 size-4 text-muted-foreground group-hover:translate-x-0.5" />
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-primary/12 bg-primary/[0.035] p-5">
            <Sparkles className="size-5 text-accent" />
            <h2 className="mt-4 text-sm font-bold text-foreground">Bắt đầu từ prompt mẫu</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Chọn cấu trúc đã lưu để tạo brief nhất quán cho tập phim mới.
            </p>
            <Button variant="outline" size="sm" className="mt-4 w-full justify-between bg-surface">
              Mở thư viện prompt
              <ArrowRight />
            </Button>
          </section>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock3 className="size-3.5" />
            Dữ liệu mẫu · Chưa kết nối lưu trữ
          </div>
        </aside>
      </div>
    </div>
  )
}
