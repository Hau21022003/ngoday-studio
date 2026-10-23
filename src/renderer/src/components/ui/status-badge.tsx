import { CircleCheck, CircleMinus, CircleSmall } from "lucide-react"

import { Badge } from "@/components/ui/badge"

type StatusTone = "success" | "warning" | "neutral" | "info"

const icons = {
  success: CircleCheck,
  warning: CircleSmall,
  neutral: CircleMinus,
  info: CircleSmall,
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const Icon = icons[tone]
  return (
    <Badge variant={tone}>
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </Badge>
  )
}

export { StatusBadge }
export type { StatusTone }
