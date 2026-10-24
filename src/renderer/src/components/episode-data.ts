import {
  Atom,
  BrainCircuit,
  Cat,
  HeartPulse,
  Landmark,
  MoonStar,
  Orbit,
  PawPrint,
  Pyramid,
  ScrollText,
  type LucideIcon,
} from "lucide-react"

import type {
  EpisodeAggregate,
  EpisodeSummary,
  EpisodeTopic,
  EpisodeWorkflowStatus,
} from "../../../shared/domain"
import type { StatusTone } from "@/components/ui/status-badge"

type EpisodeThumbnailKind = "black-hole" | "cat" | "dejavu" | "history" | "pyramid" | "sleep"

type EpisodeRecord = EpisodeSummary & {
  thumbnail: EpisodeThumbnailKind
  status: EpisodeWorkflowStatus
  updatedBy: string
}

const topics: Record<EpisodeTopic, { icon: LucideIcon; label: string; tone: "danger" | "info" | "lavender" | "success" }> = {
  animals: { icon: PawPrint, label: "Động vật", tone: "success" },
  health: { icon: HeartPulse, label: "Cơ thể", tone: "danger" },
  history: { icon: Landmark, label: "Lịch sử", tone: "lavender" },
  psychology: { icon: BrainCircuit, label: "Tâm lý", tone: "danger" },
  science: { icon: Atom, label: "Khoa học", tone: "info" },
}

const workflowStatuses: Record<EpisodeWorkflowStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Ý tưởng", tone: "warning" },
  scenes_ready: { label: "Scenes sẵn sàng", tone: "success" },
  producing: { label: "Đang sản xuất", tone: "info" },
  ready_to_export: { label: "Sẵn sàng xuất", tone: "success" },
}

const thumbnailStyles: Record<EpisodeThumbnailKind, { background: string; icon: LucideIcon; ornament: string }> = {
  "black-hole": { background: "bg-primary", icon: Orbit, ornament: "bg-warning" },
  cat: { background: "bg-info-soft", icon: Cat, ornament: "bg-info" },
  dejavu: { background: "bg-primary", icon: BrainCircuit, ornament: "bg-accent" },
  history: { background: "bg-warning-soft", icon: ScrollText, ornament: "bg-danger" },
  pyramid: { background: "bg-accent-soft", icon: Pyramid, ornament: "bg-warning" },
  sleep: { background: "bg-lavender-soft", icon: MoonStar, ornament: "bg-lavender" },
}

const thumbnailByTopic: Record<EpisodeTopic, EpisodeThumbnailKind> = {
  animals: "cat",
  health: "sleep",
  history: "history",
  psychology: "dejavu",
  science: "black-hole",
}

function toEpisodeRecord(episode: EpisodeSummary | EpisodeAggregate): EpisodeRecord {
  return {
    ...episode,
    thumbnail: thumbnailByTopic[episode.topic],
    status: episode.workflowStatus,
    updatedBy: episode.updatedByName,
  }
}

export { thumbnailStyles, toEpisodeRecord, topics, workflowStatuses }
export type { EpisodeRecord, EpisodeThumbnailKind }
