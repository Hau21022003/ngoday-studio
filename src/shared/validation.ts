import { z } from "zod"

const uuid = z.string().uuid()
const utcTimestamp = z.string().datetime({ offset: true })
const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const revision = z.number().int().min(1)
const pageNumber = z.number().int().min(1).optional()
const pageSize = z.number().int().min(1).max(100).optional()

export const templatePurposeSchema = z.enum(["scene", "thumbnail", "hook", "description", "idea", "other"])
export const templateStatusSchema = z.enum(["experimental", "active", "inactive"])
export const episodeTopicSchema = z.enum(["animals", "health", "history", "psychology", "science"])
export const episodeWorkflowStatusSchema = z.enum(["draft", "scenes_ready", "producing", "ready_to_export"])
export const sceneStatusSchema = z.enum(["draft", "in_review", "approved", "needs_changes"])
export const sceneTypeSchema = z.enum([
  "MAIN_CHARACTER",
  "ENVIRONMENT",
  "SCIENTIFIC_VISUALIZATION",
  "MOTION_GRAPHIC",
  "B_ROLL",
])
export const mediaTypeSchema = z.enum(["image", "video"])
export const assetSlotStatusSchema = z.enum(["draft", "ready", "fulfilled"])
export const assetStatusSchema = z.enum(["candidate", "accepted", "rejected"])
export const assetOriginSchema = z.enum(["imported", "generated"])
export const assetFileIntegritySchema = z.enum(["unattached", "available", "missing", "hash_mismatch"])
export const importModeSchema = z.enum(["append", "replace"])

export const templateVariableSchema = z
  .object({
    id: uuid,
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240),
    type: z.enum(["text", "multiline", "number", "select"]),
    required: z.boolean(),
    defaultValue: z.string().max(10_000),
    options: z.array(z.string().trim().min(1).max(160)).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === "select" && value.options.length === 0) {
      context.addIssue({ code: "custom", path: ["options"], message: "Select variable cần ít nhất một option." })
    }
    if (value.type !== "select" && value.options.length > 0) {
      context.addIssue({ code: "custom", path: ["options"], message: "Chỉ select variable được khai báo options." })
    }
  })

const variablesSchema = z
  .array(templateVariableSchema)
  .max(100)
  .superRefine((variables, context) => {
    const names = new Set<string>()
    for (const [index, variable] of variables.entries()) {
      if (names.has(variable.name)) {
        context.addIssue({ code: "custom", path: [index, "name"], message: "Tên variable bị trùng." })
      }
      names.add(variable.name)
    }
  })

export const templateSchema = z
  .object({
    id: uuid,
    name: z.string(),
    nameKey: z.string(),
    description: z.string(),
    purpose: templatePurposeSchema,
    status: templateStatusSchema,
    revisionNo: revision,
    createdByName: z.string(),
    createdAt: utcTimestamp,
    updatedAt: utcTimestamp,
  })
  .strict()

export const templateVersionSchema = z
  .object({
    id: uuid,
    templateId: uuid,
    major: z.number().int().min(1),
    minor: z.number().int().min(0),
    content: z.string(),
    variables: variablesSchema,
    changeNote: z.string(),
    contentHash: sha256,
    createdByName: z.string(),
    createdAt: utcTimestamp,
  })
  .strict()

export const templateSummarySchema = templateSchema.extend({
  currentVersion: z.object({ major: z.number().int(), minor: z.number().int() }).strict().nullable(),
  usageCount: z.number().int().min(0),
})

export const templateAggregateSchema = templateSummarySchema.extend({ versions: z.array(templateVersionSchema) })

export const episodeSchema = z
  .object({
    id: uuid,
    title: z.string(),
    slug: z.string(),
    slugKey: z.string(),
    topic: episodeTopicSchema,
    description: z.string(),
    notes: z.string(),
    thumbnailRelativePath: z.string().nullable(),
    revisionNo: revision,
    createdByName: z.string(),
    updatedByName: z.string(),
    createdAt: utcTimestamp,
    updatedAt: utcTimestamp,
    archivedAt: utcTimestamp.nullable(),
  })
  .strict()

export const sceneImportBatchSchema = z
  .object({
    id: uuid,
    episodeId: uuid,
    templateVersionId: uuid,
    mode: importModeSchema,
    payloadHash: sha256,
    renderedPromptHash: sha256.nullable(),
    sceneCount: z.number().int().min(1).max(200),
    createdAt: utcTimestamp,
  })
  .strict()

export const sceneSchema = z
  .object({
    id: uuid,
    episodeId: uuid,
    displayOrder: z.number().int().min(1),
    canonicalNo: z.number().int().min(1),
    title: z.string(),
    summary: z.string(),
    narration: z.string(),
    visualDescription: z.string(),
    sceneType: sceneTypeSchema,
    defaultMediaType: mediaTypeSchema,
    notes: z.string(),
    status: sceneStatusSchema,
    sourceImportBatchId: uuid.nullable(),
    revisionNo: revision,
    approvedAt: utcTimestamp.nullable(),
    createdAt: utcTimestamp,
    updatedAt: utcTimestamp,
  })
  .strict()

export const assetSlotSchema = z
  .object({
    id: uuid,
    episodeId: uuid,
    sceneId: uuid,
    slotOrder: z.number().int().min(1).max(999),
    canonicalName: z.string().regex(/^scene-[0-9]{2,}-[0-9]{2,}$/),
    canonicalNameKey: z.string().regex(/^scene-[0-9]{2,}-[0-9]{2,}$/),
    mediaType: mediaTypeSchema,
    prompt: z.string(),
    required: z.boolean(),
    status: assetSlotStatusSchema,
    revisionNo: revision,
    createdAt: utcTimestamp,
    updatedAt: utcTimestamp,
  })
  .strict()

export const assetSchema = z
  .object({
    id: uuid,
    assetSlotId: uuid,
    status: assetStatusSchema,
    origin: assetOriginSchema,
    promptSnapshot: z.string(),
    relativePath: z.string().nullable(),
    previewRelativePath: z.string().nullable(),
    fileName: z.string().nullable(),
    mimeType: z.string().nullable(),
    bytes: z.number().int().min(0).nullable(),
    sha256: sha256.nullable(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    durationMs: z.number().int().positive().nullable(),
    revisionNo: revision,
    createdAt: utcTimestamp,
    acceptedAt: utcTimestamp.nullable(),
    rejectedAt: utcTimestamp.nullable(),
    archivedAt: utcTimestamp.nullable(),
  })
  .strict()

export const episodeSummarySchema = episodeSchema.extend({
  workflowStatus: episodeWorkflowStatusSchema,
  sceneCount: z.number().int().min(0),
  productionProgress: z.number().min(0).max(100),
})

export const episodeAggregateSchema = episodeSummarySchema.extend({ scenes: z.array(sceneSchema) })
export const sceneDetailSchema = sceneSchema.extend({
  assetSlots: z.array(assetSlotSchema),
  provenance: sceneImportBatchSchema.nullable(),
})
export const assetProjectionSchema = assetSchema.extend({
  fileIntegrity: assetFileIntegritySchema,
  slot: assetSlotSchema,
  scene: z.object({ id: uuid, title: z.string(), canonicalNo: z.number().int(), sceneType: sceneTypeSchema }).strict(),
})

export const templateListQuerySchema = z
  .object({
    page: pageNumber,
    pageSize,
    search: z.string().max(200).optional(),
    purpose: templatePurposeSchema.optional(),
    status: templateStatusSchema.optional(),
  })
  .strict()

export const episodeListQuerySchema = z
  .object({
    page: pageNumber,
    pageSize,
    search: z.string().max(200).optional(),
    topic: episodeTopicSchema.optional(),
    workflowStatus: episodeWorkflowStatusSchema.optional(),
    includeArchived: z.boolean().optional(),
  })
  .strict()

export const assetListQuerySchema = z
  .object({
    episodeId: uuid,
    assetSlotId: uuid.optional(),
    page: pageNumber,
    pageSize,
    search: z.string().max(200).optional(),
    mediaType: mediaTypeSchema.optional(),
    status: assetStatusSchema.optional(),
  })
  .strict()

export const createTemplateCommandSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    description: z.string().trim().min(10).max(240),
    purpose: templatePurposeSchema,
    status: templateStatusSchema,
    content: z.string().min(1).max(20_000),
    variables: variablesSchema,
    changeNote: z.string().trim().min(3).max(160),
    createdByName: z.string().trim().min(1).max(80),
  })
  .strict()

export const updateTemplateCommandSchema = z
  .object({
    id: uuid,
    expectedRevisionNo: revision,
    patch: z
      .object({
        name: z.string().trim().min(3).max(80).optional(),
        description: z.string().trim().min(10).max(240).optional(),
        purpose: templatePurposeSchema.optional(),
        status: templateStatusSchema.optional(),
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, "Patch không được rỗng."),
  })
  .strict()

export const createTemplateVersionCommandSchema = z
  .object({
    templateId: uuid,
    expectedTemplateRevisionNo: revision,
    content: z.string().min(1).max(20_000),
    variables: variablesSchema,
    changeNote: z.string().trim().min(3).max(160),
    createdByName: z.string().trim().min(1).max(80),
  })
  .strict()

export const saveTemplateEditCommandSchema = z
  .object({
    id: uuid,
    expectedRevisionNo: revision,
    patch: z
      .object({
        name: z.string().trim().min(3).max(80).optional(),
        description: z.string().trim().min(10).max(240).optional(),
        purpose: templatePurposeSchema.optional(),
        status: templateStatusSchema.optional(),
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, "Patch không được rỗng.")
      .optional(),
    version: z
      .object({
        content: z.string().min(1).max(20_000),
        variables: variablesSchema,
        changeNote: z.string().trim().min(3).max(160),
        createdByName: z.string().trim().min(1).max(80),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => value.patch !== undefined || value.version !== undefined, {
    message: "Cần metadata patch hoặc version mới.",
  })

export const renderTemplateCommandSchema = z
  .object({ templateVersionId: uuid, values: z.record(z.string(), z.string().max(20_000)) })
  .strict()

const relativePath = z.string().max(500).refine((value) => !/^(?:[a-zA-Z]:[\\/]|[\\/]{1,2})/.test(value) && !value.split(/[\\/]/).includes(".."), {
  message: "Path phải là relative path an toàn.",
})

const thumbnailMimeTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"])
const base64PayloadSchema = z
  .string()
  .min(4)
  .max(7_000_000)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Dữ liệu thumbnail phải là base64 hợp lệ.")

export const importEpisodeThumbnailCommandSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: thumbnailMimeTypeSchema,
    dataBase64: base64PayloadSchema,
  })
  .strict()

export const readEpisodeThumbnailCommandSchema = z.object({ relativePath }).strict()

export const episodeThumbnailContentSchema = z
  .object({
    relativePath,
    mimeType: thumbnailMimeTypeSchema,
    dataUrl: z.string().max(7_100_000).regex(/^data:image\/(?:png|jpeg|webp);base64,/),
  })
  .strict()

export const createEpisodeCommandSchema = z
  .object({
    title: z.string().trim().min(3).max(100),
    slug: z.string().trim().min(3).max(100).optional(),
    topic: episodeTopicSchema,
    description: z.string().trim().min(10).max(240),
    notes: z.string().max(240).optional(),
    thumbnailRelativePath: relativePath.nullable().optional(),
    createdByName: z.string().trim().min(1).max(80),
  })
  .strict()

export const updateEpisodeCommandSchema = z
  .object({
    id: uuid,
    expectedRevisionNo: revision,
    updatedByName: z.string().trim().min(1).max(80),
    patch: z
      .object({
        title: z.string().trim().min(3).max(100).optional(),
        slug: z.string().trim().min(3).max(100).optional(),
        topic: episodeTopicSchema.optional(),
        description: z.string().trim().min(10).max(240).optional(),
        notes: z.string().max(240).optional(),
        thumbnailRelativePath: relativePath.nullable().optional(),
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, "Patch không được rỗng."),
  })
  .strict()

export const archiveEpisodeCommandSchema = z
  .object({ id: uuid, expectedRevisionNo: revision, updatedByName: z.string().trim().min(1).max(80) })
  .strict()

export const renderScenePromptCommandSchema = z
  .object({
    episodeId: uuid,
    templateVersionId: uuid,
    sourceContent: z.string().max(100_000).optional(),
    values: z.record(z.string(), z.string().max(20_000)).optional(),
  })
  .strict()

const sceneImportSlotInputSchema = z
  .object({
    order: z.number().int().min(1).max(999),
    mediaType: mediaTypeSchema,
    prompt: z.string().max(20_000),
    required: z.boolean(),
  })
  .strict()

const sceneImportItemSchema = z
  .object({
    order: z.number().int().min(1).max(200),
    title: z.string().trim().min(1).max(120),
    summary: z.string().max(500).optional().default(""),
    narration: z.string().max(10_000),
    visualDescription: z.string().max(5_000),
    sceneType: sceneTypeSchema,
    mediaType: mediaTypeSchema,
    notes: z.string().max(2_000).optional().default(""),
    assetSlots: z.array(sceneImportSlotInputSchema).max(999).optional().default([]),
  })
  .strict()
  .superRefine((scene, context) => {
    const orders = scene.assetSlots.map((slot) => slot.order).sort((a, b) => a - b)
    if (orders.some((order, index) => order !== index + 1)) {
      context.addIssue({ code: "custom", path: ["assetSlots"], message: "Slot order phải là tập liên tục 1..M." })
    }
  })

export const scenesImportDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    scenes: z.array(sceneImportItemSchema).min(1).max(200),
  })
  .strict()
  .superRefine((document, context) => {
    const orders = document.scenes.map((scene) => scene.order).sort((a, b) => a - b)
    if (orders.some((order, index) => order !== index + 1)) {
      context.addIssue({ code: "custom", path: ["scenes"], message: "Scene order phải là tập liên tục 1..N." })
    }
  })

export const validateScenesImportCommandSchema = z
  .object({
    episodeId: uuid,
    templateVersionId: uuid,
    renderedPromptHash: sha256.optional(),
    mode: importModeSchema,
    rawJson: z.string().min(1).max(1024 * 1024),
  })
  .strict()

export const commitScenesImportCommandSchema = validateScenesImportCommandSchema.extend({
  payloadHash: sha256,
  expectedEpisodeRevisionNo: revision,
})

export const updateSceneCommandSchema = z
  .object({
    id: uuid,
    expectedRevisionNo: revision,
    patch: z
      .object({
        title: z.string().trim().min(1).max(120).optional(),
        summary: z.string().max(500).optional(),
        narration: z.string().max(10_000).optional(),
        visualDescription: z.string().max(5_000).optional(),
        sceneType: sceneTypeSchema.optional(),
        defaultMediaType: mediaTypeSchema.optional(),
        notes: z.string().max(2_000).optional(),
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, "Patch không được rỗng."),
  })
  .strict()

export const reorderScenesCommandSchema = z
  .object({
    episodeId: uuid,
    orderedSceneIds: z.array(uuid).min(1).max(200),
    expectedEpisodeRevisionNo: revision,
  })
  .strict()

export const transitionSceneStatusCommandSchema = z
  .object({ id: uuid, status: sceneStatusSchema, expectedRevisionNo: revision })
  .strict()

export const createAssetSlotCommandSchema = z
  .object({
    episodeId: uuid,
    sceneId: uuid,
    mediaType: mediaTypeSchema,
    prompt: z.string().max(20_000),
    required: z.boolean(),
    expectedSceneRevisionNo: revision,
  })
  .strict()

export const updateAssetSlotCommandSchema = z
  .object({
    id: uuid,
    expectedRevisionNo: revision,
    patch: z
      .object({
        mediaType: mediaTypeSchema.optional(),
        prompt: z.string().max(20_000).optional(),
        required: z.boolean().optional(),
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, "Patch không được rỗng."),
  })
  .strict()

export const importAssetFileCommandSchema = z
  .object({
    assetSlotId: uuid,
    expectedAssetSlotRevisionNo: revision,
  })
  .strict()

export const importAssetFileResultSchema = z
  .object({ cancelled: z.boolean(), asset: assetProjectionSchema.nullable() })
  .strict()

export const metadataBackupPayloadSchema = z
  .object({
    templates: z.array(templateSchema),
    templateVersions: z.array(templateVersionSchema),
    episodes: z.array(episodeSchema),
    sceneImportBatches: z.array(sceneImportBatchSchema),
    scenes: z.array(sceneSchema),
    assetSlots: z.array(assetSlotSchema),
    assets: z.array(assetSchema),
  })
  .strict()

export const metadataBackupDocumentSchema = z
  .object({
    format: z.literal("ngoday-studio-metadata"),
    formatVersion: z.literal(1),
    databaseSchemaVersion: z.literal(1),
    appVersion: z.string().min(1).max(100),
    createdAt: utcTimestamp,
    payloadHash: sha256,
    payload: metadataBackupPayloadSchema,
  })
  .strict()

export const metadataBackupSummarySchema = z
  .object({
    templates: z.number().int().min(0),
    templateVersions: z.number().int().min(0),
    episodes: z.number().int().min(0),
    scenes: z.number().int().min(0),
    assetSlots: z.number().int().min(0),
    assets: z.number().int().min(0),
  })
  .strict()

export const metadataBackupResultSchema = z
  .object({
    cancelled: z.boolean(),
    fileName: z.string().min(1).max(255).nullable(),
    summary: metadataBackupSummarySchema.nullable(),
  })
  .strict()

export const assetTransitionCommandSchema = z.object({ id: uuid, expectedRevisionNo: revision }).strict()
export const idCommandSchema = z.object({ id: uuid }).strict()
export const episodeIdCommandSchema = z.object({ episodeId: uuid }).strict()

export const renderedPromptSchema = z
  .object({ templateVersionId: uuid, content: z.string(), contentHash: sha256 })
  .strict()

export const scenesImportPreviewSchema = z
  .object({
    payloadHash: sha256,
    document: scenesImportDocumentSchema,
    sceneCount: z.number().int().min(1),
    slotCount: z.number().int().min(1),
    warnings: z.array(z.string()),
  })
  .strict()

export const scenesImportResultSchema = z
  .object({
    importBatchId: uuid,
    episodeRevisionNo: revision,
    scenes: z.array(sceneSchema),
    assetSlots: z.array(assetSlotSchema),
  })
  .strict()

export function pageSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      items: z.array(itemSchema),
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1),
      total: z.number().int().min(0),
    })
    .strict()
}
