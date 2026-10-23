import { FileText, Image, Laptop, Lightbulb, Mountain, ScrollText } from "lucide-react"

import { cn } from "@/lib/utils"

const thumbnailStyles = {
  desk: { className: "bg-[#d7cab4] text-[#5c4933]", icon: FileText },
  mountain: { className: "bg-[#c8d9de] text-[#355b68]", icon: Mountain },
  studio: { className: "bg-[#d9d0bf] text-[#665844]", icon: Image },
  notes: { className: "bg-[#ddd4c6] text-[#604f3a]", icon: ScrollText },
  idea: { className: "bg-[#1d2834] text-[#ffc35a]", icon: Lightbulb },
  laptop: { className: "bg-[#cbc5bc] text-[#3f4854]", icon: Laptop },
} as const

type ThumbnailKind = keyof typeof thumbnailStyles

function TemplateThumbnail({
  kind,
  className,
}: {
  kind: ThumbnailKind
  className?: string
}) {
  const style = thumbnailStyles[kind]
  const Icon = style.icon

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-black/5",
        style.className,
        className,
      )}
    >
      <span className="absolute inset-x-0 bottom-0 h-2 bg-black/8" />
      <Icon className="relative size-5" strokeWidth={1.7} />
    </span>
  )
}

export { TemplateThumbnail }
export type { ThumbnailKind }
