export type EntityId = string
export type UtcTimestamp = string

export type TemplatePurpose = "scene" | "thumbnail" | "hook" | "description" | "idea" | "other"
export type TemplateStatus = "experimental" | "active" | "inactive"
export type TemplateVariableType = "text" | "multiline" | "number" | "select"
export type EpisodeTopic = "animals" | "health" | "history" | "psychology" | "science"
export type EpisodeWorkflowStatus = "draft" | "scenes_ready" | "producing" | "ready_to_export"
export type SceneStatus = "draft" | "in_review" | "approved" | "needs_changes"
export type SceneType =
  | "MAIN_CHARACTER"
  | "ENVIRONMENT"
  | "SCIENTIFIC_VISUALIZATION"
  | "MOTION_GRAPHIC"
  | "B_ROLL"
export type MediaType = "image" | "video"
export type AssetSlotStatus = "draft" | "ready" | "fulfilled"
export type AssetStatus = "candidate" | "accepted" | "rejected"
export type AssetOrigin = "imported" | "generated"
export type AssetFileIntegrity = "unattached" | "available" | "missing" | "hash_mismatch"
export type ImportMode = "append" | "replace"

export type Page<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export type TemplateVariableDefinition = {
  id: EntityId
  name: string
  label: string
  description: string
  type: TemplateVariableType
  required: boolean
  defaultValue: string
  options: string[]
}

export type Template = {
  id: EntityId
  name: string
  nameKey: string
  description: string
  purpose: TemplatePurpose
  status: TemplateStatus
  revisionNo: number
  createdByName: string
  createdAt: UtcTimestamp
  updatedAt: UtcTimestamp
}

export type TemplateVersion = {
  id: EntityId
  templateId: EntityId
  major: number
  minor: number
  content: string
  variables: TemplateVariableDefinition[]
  changeNote: string
  contentHash: string
  createdByName: string
  createdAt: UtcTimestamp
}

export type TemplateSummary = Template & {
  currentVersion: { major: number; minor: number } | null
  usageCount: number
}

export type TemplateAggregate = TemplateSummary & {
  versions: TemplateVersion[]
}

export type Episode = {
  id: EntityId
  title: string
  slug: string
  slugKey: string
  topic: EpisodeTopic
  description: string
  notes: string
  thumbnailRelativePath: string | null
  revisionNo: number
  createdByName: string
  updatedByName: string
  createdAt: UtcTimestamp
  updatedAt: UtcTimestamp
  archivedAt: UtcTimestamp | null
}

export type EpisodeSummary = Episode & {
  workflowStatus: EpisodeWorkflowStatus
  sceneCount: number
  productionProgress: number
}

export type EpisodeAggregate = EpisodeSummary & {
  scenes: Scene[]
}

export type SceneImportBatch = {
  id: EntityId
  episodeId: EntityId
  templateVersionId: EntityId
  mode: ImportMode
  payloadHash: string
  renderedPromptHash: string | null
  sceneCount: number
  createdAt: UtcTimestamp
}

export type Scene = {
  id: EntityId
  episodeId: EntityId
  displayOrder: number
  canonicalNo: number
  title: string
  summary: string
  narration: string
  visualDescription: string
  sceneType: SceneType
  defaultMediaType: MediaType
  notes: string
  status: SceneStatus
  sourceImportBatchId: EntityId | null
  revisionNo: number
  approvedAt: UtcTimestamp | null
  createdAt: UtcTimestamp
  updatedAt: UtcTimestamp
}

export type SceneDetail = Scene & {
  assetSlots: AssetSlot[]
  provenance: SceneImportBatch | null
}

export type AssetSlot = {
  id: EntityId
  episodeId: EntityId
  sceneId: EntityId
  slotOrder: number
  canonicalName: string
  canonicalNameKey: string
  mediaType: MediaType
  prompt: string
  required: boolean
  status: AssetSlotStatus
  revisionNo: number
  createdAt: UtcTimestamp
  updatedAt: UtcTimestamp
}

export type Asset = {
  id: EntityId
  assetSlotId: EntityId
  status: AssetStatus
  origin: AssetOrigin
  promptSnapshot: string
  relativePath: string | null
  previewRelativePath: string | null
  fileName: string | null
  mimeType: string | null
  bytes: number | null
  sha256: string | null
  width: number | null
  height: number | null
  durationMs: number | null
  revisionNo: number
  createdAt: UtcTimestamp
  acceptedAt: UtcTimestamp | null
  rejectedAt: UtcTimestamp | null
  archivedAt: UtcTimestamp | null
}

export type AssetProjection = Asset & {
  fileIntegrity: AssetFileIntegrity
  slot: AssetSlot
  scene: Pick<Scene, "id" | "title" | "canonicalNo" | "sceneType">
}

export type TemplateListQuery = {
  page?: number
  pageSize?: number
  search?: string
  purpose?: TemplatePurpose
  status?: TemplateStatus
}

export type EpisodeListQuery = {
  page?: number
  pageSize?: number
  search?: string
  topic?: EpisodeTopic
  workflowStatus?: EpisodeWorkflowStatus
  includeArchived?: boolean
}

export type AssetListQuery = {
  episodeId: EntityId
  page?: number
  pageSize?: number
  search?: string
  mediaType?: MediaType
  status?: AssetStatus
}

export type CreateTemplateCommand = {
  name: string
  description: string
  purpose: TemplatePurpose
  status: TemplateStatus
  content: string
  variables: TemplateVariableDefinition[]
  changeNote: string
  createdByName: string
}

export type UpdateTemplateCommand = {
  id: EntityId
  expectedRevisionNo: number
  patch: Partial<Pick<Template, "name" | "description" | "purpose" | "status">>
}

export type CreateTemplateVersionCommand = {
  templateId: EntityId
  expectedTemplateRevisionNo: number
  content: string
  variables: TemplateVariableDefinition[]
  changeNote: string
  createdByName: string
}

export type SaveTemplateEditCommand = {
  id: EntityId
  expectedRevisionNo: number
  patch?: Partial<Pick<Template, "name" | "description" | "purpose" | "status">>
  version?: {
    content: string
    variables: TemplateVariableDefinition[]
    changeNote: string
    createdByName: string
  }
}

export type RenderTemplateCommand = {
  templateVersionId: EntityId
  values: Record<string, string>
}

export type RenderedPrompt = {
  templateVersionId: EntityId
  content: string
  contentHash: string
}

export type CreateEpisodeCommand = {
  title: string
  slug?: string
  topic: EpisodeTopic
  description: string
  notes?: string
  thumbnailRelativePath?: string | null
  createdByName: string
}

export type UpdateEpisodeCommand = {
  id: EntityId
  expectedRevisionNo: number
  updatedByName: string
  patch: Partial<Pick<Episode, "title" | "slug" | "topic" | "description" | "notes" | "thumbnailRelativePath">>
}

export type ArchiveEpisodeCommand = {
  id: EntityId
  expectedRevisionNo: number
  updatedByName: string
}

export type ImportEpisodeThumbnailCommand = {
  fileName: string
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  dataBase64: string
}

export type ReadEpisodeThumbnailCommand = {
  relativePath: string
}

export type EpisodeThumbnailContent = {
  relativePath: string
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  dataUrl: string
}

export type RenderScenePromptCommand = {
  episodeId: EntityId
  templateVersionId: EntityId
  sourceContent?: string
  values?: Record<string, string>
}

export type SceneImportSlotInput = {
  order: number
  mediaType: MediaType
  prompt: string
  required: boolean
}

export type SceneImportItem = {
  order: number
  title: string
  summary: string
  narration: string
  visualDescription: string
  sceneType: SceneType
  mediaType: MediaType
  notes: string
  assetSlots: SceneImportSlotInput[]
}

export type ScenesImportDocument = {
  schemaVersion: 1
  scenes: SceneImportItem[]
}

export type ValidateScenesImportCommand = {
  episodeId: EntityId
  templateVersionId: EntityId
  renderedPromptHash?: string
  mode: ImportMode
  rawJson: string
}

export type ScenesImportPreview = {
  payloadHash: string
  document: ScenesImportDocument
  sceneCount: number
  slotCount: number
  warnings: string[]
}

export type CommitScenesImportCommand = ValidateScenesImportCommand & {
  payloadHash: string
  expectedEpisodeRevisionNo: number
}

export type ScenesImportResult = {
  importBatchId: EntityId
  episodeRevisionNo: number
  scenes: Scene[]
  assetSlots: AssetSlot[]
}

export type UpdateSceneCommand = {
  id: EntityId
  expectedRevisionNo: number
  patch: Partial<
    Pick<Scene, "title" | "summary" | "narration" | "visualDescription" | "sceneType" | "defaultMediaType" | "notes">
  >
}

export type ReorderScenesCommand = {
  episodeId: EntityId
  orderedSceneIds: EntityId[]
  expectedEpisodeRevisionNo: number
}

export type TransitionSceneStatusCommand = {
  id: EntityId
  status: SceneStatus
  expectedRevisionNo: number
}

export type CreateAssetSlotCommand = {
  episodeId: EntityId
  sceneId: EntityId
  mediaType: MediaType
  prompt: string
  required: boolean
  expectedSceneRevisionNo: number
}

export type UpdateAssetSlotCommand = {
  id: EntityId
  expectedRevisionNo: number
  patch: Partial<Pick<AssetSlot, "mediaType" | "prompt" | "required">>
}

export type RegisterImportedAssetCommand = {
  assetSlotId: EntityId
  expectedAssetSlotRevisionNo: number
  promptSnapshot: string
  sourcePath: string
  previewSourcePath?: string
  mimeType: string
  bytes: number
  sha256: string
  width?: number
  height?: number
  durationMs?: number
}

export type AssetTransitionCommand = {
  id: EntityId
  expectedRevisionNo: number
}

export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DUPLICATE_NAME"
  | "STALE_REVISION"
  | "INVALID_TRANSITION"
  | "IMPORT_INVALID"
  | "SCENES_REPLACE_CONFLICT"
  | "FILE_OUTSIDE_WORKSPACE"
  | "DB_UNAVAILABLE"
  | "MIGRATION_REQUIRED"
  | "INTERNAL_ERROR"

export type DomainErrorPayload = {
  code: DomainErrorCode
  message: string
  fieldErrors?: Record<string, string>
  retryable: boolean
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: DomainErrorPayload }
