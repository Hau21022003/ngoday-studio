import { CircleAlert, FileQuestion, LoaderCircle, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StateFeedbackProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
  role?: "alert" | "status"
}

function StateFeedback({ icon: Icon, title, description, action, className, role }: StateFeedbackProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
    >
      <div className="grid size-10 place-items-center rounded-md border border-border bg-muted/55 text-muted-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <h2 className="mt-4 text-sm font-bold text-foreground text-balance">{title}</h2>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground text-pretty">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function EmptyState({ action }: { action?: ReactNode }) {
  return (
    <StateFeedback
      icon={FileQuestion}
      title="Chưa có dữ liệu"
      description="Thay đổi bộ lọc hoặc tạo mục đầu tiên để bắt đầu."
      action={action}
    />
  )
}

function LoadingState() {
  return (
    <StateFeedback
      role="status"
      icon={LoaderCircle}
      title="Đang tải…"
      description="Dữ liệu đang được chuẩn bị."
      className="[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none"
    />
  )
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateFeedback
      role="alert"
      icon={CircleAlert}
      title="Không thể tải dữ liệu"
      description="Kiểm tra kết nối hoặc thử tải lại. Dữ liệu cục bộ không bị thay đổi."
      action={
        onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        ) : undefined
      }
    />
  )
}

function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded bg-muted motion-reduce:animate-none", className)} />
}

export { EmptyState, ErrorState, LoadingState, Skeleton, StateFeedback }
