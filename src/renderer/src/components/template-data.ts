import type {
  TemplateAggregate,
  TemplatePurpose,
  TemplateStatus as DomainTemplateStatus,
  TemplateSummary,
  TemplateVariableDefinition as DomainTemplateVariableDefinition,
  TemplateVariableType,
  TemplateVersion as DomainTemplateVersion,
} from "../../../shared/domain"

import type { StatusTone } from "@/components/ui/status-badge"
import type { ThumbnailKind } from "@/components/ui/template-thumbnail"

type Purpose = TemplatePurpose
type TemplateStatus = DomainTemplateStatus
type VariableType = TemplateVariableType
type TemplateVariableDefinition = DomainTemplateVariableDefinition

type TemplateVersion = {
  id: string
  major: number
  minor: number
  version: string
  content: string
  variables: TemplateVariableDefinition[]
  changeNote: string
  createdAt: string
  createdBy: string
}

type TemplateRecord = {
  id: string
  name: string
  nameKey: string
  description: string
  purpose: Purpose
  status: TemplateStatus
  thumbnail: ThumbnailKind
  usageCount: number
  revisionNo: number
  currentVersion: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  versions: TemplateVersion[]
}

const purposeLabels: Record<Purpose, string> = {
  scene: "Scene",
  thumbnail: "Thumbnail",
  hook: "Hook",
  description: "Mô tả",
  idea: "Ý tưởng",
  other: "Khác",
}

const purposeTones = {
  scene: "attention",
  thumbnail: "lavender",
  hook: "info",
  description: "success",
  idea: "danger",
  other: "neutral",
} as const

const statusPresentation: Record<TemplateStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Đang dùng", tone: "success" },
  experimental: { label: "Thử nghiệm", tone: "warning" },
  inactive: { label: "Không hoạt động", tone: "neutral" },
}

const thumbnailByPurpose: Record<Purpose, ThumbnailKind> = {
  scene: "desk",
  thumbnail: "studio",
  hook: "mountain",
  description: "notes",
  idea: "idea",
  other: "laptop",
}

function cloneVariables(variables: TemplateVariableDefinition[]) {
  return variables.map((variable) => ({ ...variable, options: [...variable.options] }))
}

function mapVersion(version: DomainTemplateVersion): TemplateVersion {
  return {
    id: version.id,
    major: version.major,
    minor: version.minor,
    version: `v${version.major}.${version.minor}`,
    content: version.content,
    variables: cloneVariables(version.variables),
    changeNote: version.changeNote,
    createdAt: version.createdAt,
    createdBy: version.createdByName,
  }
}

function toTemplateRecord(template: TemplateSummary | TemplateAggregate): TemplateRecord {
  const versions = "versions" in template ? template.versions.map(mapVersion) : []
  return {
    id: template.id,
    name: template.name,
    nameKey: template.nameKey,
    description: template.description,
    purpose: template.purpose,
    status: template.status,
    thumbnail: thumbnailByPurpose[template.purpose],
    usageCount: template.usageCount,
    revisionNo: template.revisionNo,
    currentVersion: template.currentVersion
      ? `v${template.currentVersion.major}.${template.currentVersion.minor}`
      : null,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    createdBy: template.createdByName,
    versions,
  }
}

function getCurrentVersion(template: TemplateRecord) {
  const version = template.versions[0]
  if (!version) throw new Error("Template aggregate không có version.")
  return version
}

function getNextVersion(version: string) {
  const match = /^v(\d+)\.(\d+)$/.exec(version)
  if (!match) return "v1.1"
  return `v${match[1]}.${Number(match[2]) + 1}`
}

export {
  cloneVariables,
  getCurrentVersion,
  getNextVersion,
  purposeLabels,
  purposeTones,
  statusPresentation,
  thumbnailByPurpose,
  toTemplateRecord,
}
export type {
  Purpose,
  TemplateRecord,
  TemplateStatus,
  TemplateVariableDefinition,
  TemplateVersion,
  VariableType,
}
