import { Clock3 } from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { StateFeedback } from "@/components/ui/state-feedback"

const pageCopy = {
  episodes: ["Episodes", "Quản lý các tập phim và tiến độ biên tập."],
  queue: ["Queue", "Theo dõi các công việc sản xuất đang chờ xử lý."],
  media: ["Media", "Quản lý media đã duyệt theo tập phim và cảnh."],
  settings: ["Settings", "Thiết lập workspace và tùy chọn mặc định."],
} as const

function WorkspacePlaceholder({ route }: { route: keyof typeof pageCopy }) {
  const [title, description] = pageCopy[route]
  return (
    <div className="min-h-screen px-5 py-6 sm:px-7 lg:px-8 lg:py-7">
      <PageHeader title={title} description={description} />
      <div className="mt-6 rounded-lg border border-border bg-surface shadow-panel">
        <StateFeedback
          icon={Clock3}
          title="Đã có chung visual foundation"
          description="Nghiệp vụ của khu vực này sẽ được triển khai trong phase tương ứng và kế thừa các component dùng chung."
        />
      </div>
    </div>
  )
}

export { WorkspacePlaceholder }
