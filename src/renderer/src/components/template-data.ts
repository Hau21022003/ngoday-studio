import type { StatusTone } from "@/components/ui/status-badge"
import type { ThumbnailKind } from "@/components/ui/template-thumbnail"

type Purpose = "script" | "thumbnail" | "hook" | "description" | "idea" | "other"
type TemplateStatus = "experimental" | "active" | "inactive"
type VariableType = "text" | "multiline" | "number" | "select"

type TemplateVariableDefinition = {
  id: string
  name: string
  label: string
  description: string
  type: VariableType
  required: boolean
  defaultValue: string
  options: string[]
}

type TemplateVersion = {
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
  description: string
  purpose: Purpose
  status: TemplateStatus
  thumbnail: ThumbnailKind
  usageCount: number
  createdAt: string
  updatedAt: string
  createdBy: string
  versions: TemplateVersion[]
}

const purposeLabels: Record<Purpose, string> = {
  script: "Script",
  thumbnail: "Thumbnail",
  hook: "Hook",
  description: "Mô tả",
  idea: "Ý tưởng",
  other: "Khác",
}

const purposeTones = {
  script: "attention",
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
  script: "desk",
  thumbnail: "studio",
  hook: "mountain",
  description: "notes",
  idea: "idea",
  other: "laptop",
}

const longFormVariables: TemplateVariableDefinition[] = [
  {
    id: "var-topic",
    name: "topic",
    label: "Chủ đề video",
    description: "Chủ đề chính cần triển khai trong kịch bản.",
    type: "text",
    required: true,
    defaultValue: "Tại sao có cảm giác Déjà vu?",
    options: [],
  },
  {
    id: "var-duration",
    name: "duration",
    label: "Độ dài (phút)",
    description: "Thời lượng mục tiêu của video.",
    type: "number",
    required: true,
    defaultValue: "10",
    options: [],
  },
  {
    id: "var-tone",
    name: "tone",
    label: "Giọng văn",
    description: "Phong cách thể hiện xuyên suốt nội dung.",
    type: "select",
    required: true,
    defaultValue: "Hài hước",
    options: ["Hài hước", "Nghiêm túc", "Gần gũi"],
  },
  {
    id: "var-key-points",
    name: "key_points",
    label: "Các ý chính",
    description: "Những ý bắt buộc phải xuất hiện trong kịch bản.",
    type: "multiline",
    required: true,
    defaultValue: "- Định nghĩa\n- Nguyên nhân\n- Ví dụ thực tế\n- Sự thật thú vị",
    options: [],
  },
]

const longFormPrompt = `Bạn là một biên tập viên YouTube chuyên nghiệp.
Hãy viết kịch bản chi tiết cho video về: “{{topic}}”
Thời lượng: khoảng {{duration}} phút.

Yêu cầu:
- Cấu trúc: Hook, mở đầu, nội dung chính, ví dụ thực tế, kết luận.
- Giọng văn: {{tone}}.
- Đưa ra các ý chính:
{{key_points}}

Định dạng rõ ràng, dễ hiểu, dùng ngôn ngữ tự nhiên,
gần gũi và phù hợp với phong cách Ngộ Dậy Studio.`

function cloneVariables(variables: TemplateVariableDefinition[]) {
  return variables.map((variable) => ({ ...variable, options: [...variable.options] }))
}

function genericVersion(
  purpose: Purpose,
  version: string,
  date: string,
  topicName = "topic",
): TemplateVersion {
  const variable: TemplateVariableDefinition = {
    id: `var-${purpose}-${topicName}`,
    name: topicName,
    label: purpose === "description" ? "Tiêu đề video" : "Chủ đề",
    description: "Nội dung chính dùng để render prompt.",
    type: "text",
    required: true,
    defaultValue: "Một chủ đề mới cho kênh",
    options: [],
  }

  return {
    version,
    content: `Bạn là một biên tập viên nội dung chuyên nghiệp.\n\nHãy tạo ${purposeLabels[purpose].toLocaleLowerCase("vi")} cho {{${topicName}}}.\n\nYêu cầu:\n- Rõ ràng, tự nhiên và dễ chỉnh sửa.\n- Phù hợp với phong cách Ngộ Dậy Studio.`,
    variables: [variable],
    changeNote: version === "v1.0" ? "Khởi tạo template." : "Tinh chỉnh cấu trúc prompt.",
    createdAt: `${date}T09:20:00+07:00`,
    createdBy: "Bạn",
  }
}

const initialTemplates: TemplateRecord[] = [
  {
    id: "youtube-long-form",
    name: "YouTube Script (Long-form)",
    description: "Tạo kịch bản chi tiết cho video dạng dài với cấu trúc rõ ràng, lôi cuốn.",
    purpose: "script",
    status: "active",
    thumbnail: "desk",
    usageCount: 24,
    createdAt: "2026-10-15T09:20:00+07:00",
    updatedAt: "2026-10-22T14:30:00+07:00",
    createdBy: "Bạn",
    versions: [
      {
        version: "v1.2",
        content: longFormPrompt,
        variables: cloneVariables(longFormVariables),
        changeNote: "Cập nhật cấu trúc, bổ sung phần CTA.",
        createdAt: "2026-10-22T14:30:00+07:00",
        createdBy: "Bạn",
      },
      {
        version: "v1.1",
        content: longFormPrompt.replace("gần gũi và phù hợp", "rõ ràng và phù hợp"),
        variables: cloneVariables(longFormVariables),
        changeNote: "Tinh chỉnh giọng văn, thêm ví dụ minh họa.",
        createdAt: "2026-10-18T10:15:00+07:00",
        createdBy: "Bạn",
      },
      {
        version: "v1.0",
        content: longFormPrompt,
        variables: cloneVariables(longFormVariables.slice(0, 3)),
        changeNote: "Khởi tạo template.",
        createdAt: "2026-10-15T09:20:00+07:00",
        createdBy: "Bạn",
      },
    ],
  },
  {
    id: "youtube-hook",
    name: "YouTube Hook Generator",
    description: "Tạo nhiều phiên bản hook hấp dẫn dành cho video.",
    purpose: "hook",
    status: "active",
    thumbnail: "mountain",
    usageCount: 18,
    createdAt: "2026-10-20T09:20:00+07:00",
    updatedAt: "2026-10-20T14:30:00+07:00",
    createdBy: "Bạn",
    versions: [genericVersion("hook", "v1.0", "2026-10-20")],
  },
  {
    id: "thumbnail-concept",
    name: "Thumbnail Concept",
    description: "Tạo ý tưởng thumbnail sáng tạo, phù hợp với nội dung video.",
    purpose: "thumbnail",
    status: "experimental",
    thumbnail: "studio",
    usageCount: 9,
    createdAt: "2026-10-12T09:20:00+07:00",
    updatedAt: "2026-10-18T14:30:00+07:00",
    createdBy: "Bạn",
    versions: [genericVersion("thumbnail", "v1.1", "2026-10-18"), genericVersion("thumbnail", "v1.0", "2026-10-12")],
  },
  {
    id: "video-description",
    name: "Video Description",
    description: "Tạo mô tả YouTube chuẩn SEO, bao gồm từ khóa và timestamp.",
    purpose: "description",
    status: "inactive",
    thumbnail: "notes",
    usageCount: 6,
    createdAt: "2026-10-15T09:20:00+07:00",
    updatedAt: "2026-10-15T14:30:00+07:00",
    createdBy: "Bạn",
    versions: [genericVersion("description", "v1.0", "2026-10-15", "title")],
  },
  {
    id: "video-idea",
    name: "Video Idea Generator",
    description: "Đề xuất ý tưởng video dựa trên chủ đề và xu hướng hiện tại.",
    purpose: "idea",
    status: "active",
    thumbnail: "idea",
    usageCount: 31,
    createdAt: "2026-10-12T09:20:00+07:00",
    updatedAt: "2026-10-12T14:30:00+07:00",
    createdBy: "Bạn",
    versions: [genericVersion("idea", "v1.0", "2026-10-12")],
  },
  {
    id: "short-script",
    name: "Short Script (TikTok/Shorts)",
    description: "Tạo kịch bản ngắn, súc tích cho video ngắn.",
    purpose: "script",
    status: "experimental",
    thumbnail: "laptop",
    usageCount: 12,
    createdAt: "2026-10-10T09:20:00+07:00",
    updatedAt: "2026-10-10T14:30:00+07:00",
    createdBy: "Bạn",
    versions: [genericVersion("script", "v1.0", "2026-10-10")],
  },
]

function getCurrentVersion(template: TemplateRecord) {
  return template.versions[0]!
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
  initialTemplates,
  purposeLabels,
  purposeTones,
  statusPresentation,
  thumbnailByPurpose,
}
export type {
  Purpose,
  TemplateRecord,
  TemplateStatus,
  TemplateVariableDefinition,
  TemplateVersion,
  VariableType,
}
