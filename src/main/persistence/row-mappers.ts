import type { SQLOutputValue } from "node:sqlite"

import type {
  Asset,
  AssetSlot,
  Episode,
  Scene,
  SceneImportBatch,
  Template,
  TemplateSummary,
  TemplateVersion,
} from "../../shared/domain"
import {
  assetSchema,
  assetSlotSchema,
  episodeSchema,
  sceneImportBatchSchema,
  sceneSchema,
  templateSchema,
  templateSummarySchema,
  templateVersionSchema,
} from "../../shared/validation"

export type SqlRow = Record<string, SQLOutputValue>

function text(row: SqlRow, key: string) {
  const value = row[key]
  if (typeof value !== "string") throw new TypeError(`Expected text column ${key}.`)
  return value
}

function nullableText(row: SqlRow, key: string) {
  const value = row[key]
  if (value === null) return null
  if (typeof value !== "string") throw new TypeError(`Expected nullable text column ${key}.`)
  return value
}

function number(row: SqlRow, key: string) {
  const value = row[key]
  if (typeof value !== "number") throw new TypeError(`Expected number column ${key}.`)
  return value
}

function nullableNumber(row: SqlRow, key: string) {
  const value = row[key]
  if (value === null) return null
  if (typeof value !== "number") throw new TypeError(`Expected nullable number column ${key}.`)
  return value
}

export function mapTemplate(row: SqlRow): Template {
  return templateSchema.parse({
    id: text(row, "id"),
    name: text(row, "name"),
    nameKey: text(row, "name_key"),
    description: text(row, "description"),
    purpose: text(row, "purpose"),
    status: text(row, "status"),
    revisionNo: number(row, "revision_no"),
    createdByName: text(row, "created_by_name"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  })
}

export function mapTemplateSummary(row: SqlRow): TemplateSummary {
  const major = nullableNumber(row, "current_major")
  const minor = nullableNumber(row, "current_minor")
  return templateSummarySchema.parse({
    ...mapTemplate(row),
    currentVersion: major === null || minor === null ? null : { major, minor },
    usageCount: number(row, "usage_count"),
  })
}

export function mapTemplateVersion(row: SqlRow): TemplateVersion {
  return templateVersionSchema.parse({
    id: text(row, "id"),
    templateId: text(row, "template_id"),
    major: number(row, "major"),
    minor: number(row, "minor"),
    content: text(row, "content"),
    variables: JSON.parse(text(row, "variables_json")) as unknown,
    changeNote: text(row, "change_note"),
    contentHash: text(row, "content_hash"),
    createdByName: text(row, "created_by_name"),
    createdAt: text(row, "created_at"),
  })
}

export function mapEpisode(row: SqlRow): Episode {
  return episodeSchema.parse({
    id: text(row, "id"),
    title: text(row, "title"),
    slug: text(row, "slug"),
    slugKey: text(row, "slug_key"),
    topic: text(row, "topic"),
    description: text(row, "description"),
    notes: text(row, "notes"),
    thumbnailRelativePath: nullableText(row, "thumbnail_relative_path"),
    revisionNo: number(row, "revision_no"),
    createdByName: text(row, "created_by_name"),
    updatedByName: text(row, "updated_by_name"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    archivedAt: nullableText(row, "archived_at"),
  })
}

export function mapSceneImportBatch(row: SqlRow): SceneImportBatch {
  return sceneImportBatchSchema.parse({
    id: text(row, "id"),
    episodeId: text(row, "episode_id"),
    templateVersionId: text(row, "template_version_id"),
    mode: text(row, "mode"),
    payloadHash: text(row, "payload_hash"),
    renderedPromptHash: nullableText(row, "rendered_prompt_hash"),
    sceneCount: number(row, "scene_count"),
    createdAt: text(row, "created_at"),
  })
}

export function mapScene(row: SqlRow): Scene {
  return sceneSchema.parse({
    id: text(row, "id"),
    episodeId: text(row, "episode_id"),
    displayOrder: number(row, "display_order"),
    canonicalNo: number(row, "canonical_no"),
    title: text(row, "title"),
    summary: text(row, "summary"),
    narration: text(row, "narration"),
    visualDescription: text(row, "visual_description"),
    sceneType: text(row, "scene_type"),
    defaultMediaType: text(row, "default_media_type"),
    notes: text(row, "notes"),
    status: text(row, "status"),
    sourceImportBatchId: nullableText(row, "source_import_batch_id"),
    revisionNo: number(row, "revision_no"),
    approvedAt: nullableText(row, "approved_at"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  })
}

export function mapAssetSlot(row: SqlRow): AssetSlot {
  return assetSlotSchema.parse({
    id: text(row, "id"),
    episodeId: text(row, "episode_id"),
    sceneId: text(row, "scene_id"),
    slotOrder: number(row, "slot_order"),
    canonicalName: text(row, "canonical_name"),
    canonicalNameKey: text(row, "canonical_name_key"),
    mediaType: text(row, "media_type"),
    prompt: text(row, "prompt"),
    required: number(row, "required") === 1,
    status: text(row, "status"),
    revisionNo: number(row, "revision_no"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  })
}

export function mapAsset(row: SqlRow): Asset {
  return assetSchema.parse({
    id: text(row, "id"),
    assetSlotId: text(row, "asset_slot_id"),
    status: text(row, "status"),
    origin: text(row, "origin"),
    promptSnapshot: text(row, "prompt_snapshot"),
    relativePath: nullableText(row, "relative_path"),
    previewRelativePath: nullableText(row, "preview_relative_path"),
    fileName: nullableText(row, "file_name"),
    mimeType: nullableText(row, "mime_type"),
    bytes: nullableNumber(row, "bytes"),
    sha256: nullableText(row, "sha256"),
    width: nullableNumber(row, "width"),
    height: nullableNumber(row, "height"),
    durationMs: nullableNumber(row, "duration_ms"),
    revisionNo: number(row, "revision_no"),
    createdAt: text(row, "created_at"),
    acceptedAt: nullableText(row, "accepted_at"),
    rejectedAt: nullableText(row, "rejected_at"),
    archivedAt: nullableText(row, "archived_at"),
  })
}
