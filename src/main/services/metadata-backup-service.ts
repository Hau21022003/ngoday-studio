import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"

import type {
  Asset,
  AssetSlot,
  Episode,
  MetadataBackupDocument,
  MetadataBackupPayload,
  MetadataBackupSummary,
  Scene,
  SceneImportBatch,
  Template,
  TemplateVersion,
} from "../../shared/domain"
import { metadataBackupDocumentSchema } from "../../shared/validation"
import { DomainError } from "../domain/errors"
import { canonicalJson, newId, nowUtc, normalizeKey, sha256 } from "../domain/helpers"
import type { StudioDatabase } from "../persistence/database"
import { AssetRepository } from "../persistence/repositories/asset-repository"
import { AssetSlotRepository } from "../persistence/repositories/asset-slot-repository"
import { EpisodeRepository } from "../persistence/repositories/episode-repository"
import { MetadataBackupRepository } from "../persistence/repositories/metadata-backup-repository"
import { SceneRepository } from "../persistence/repositories/scene-repository"
import { TemplateRepository } from "../persistence/repositories/template-repository"

const maxBackupBytes = 50 * 1024 * 1024
const canonicalNamePattern = /^scene-[0-9]{2,}-[0-9]{2,}$/

function summary(payload: MetadataBackupPayload): MetadataBackupSummary {
  return {
    templates: payload.templates.length,
    templateVersions: payload.templateVersions.length,
    episodes: payload.episodes.length,
    scenes: payload.scenes.length,
    assetSlots: payload.assetSlots.length,
    assets: payload.assets.length,
  }
}
function unique(items: readonly string[], label: string) {
  if (new Set(items).size !== items.length) throw new DomainError("BACKUP_INVALID", `${label} bị trùng trong backup.`)
}

function assertReferences(payload: MetadataBackupPayload) {
  unique(payload.templates.map((item) => item.id), "Template ID")
  unique(payload.templateVersions.map((item) => item.id), "TemplateVersion ID")
  unique(payload.episodes.map((item) => item.id), "Episode ID")
  unique(payload.sceneImportBatches.map((item) => item.id), "SceneImportBatch ID")
  unique(payload.scenes.map((item) => item.id), "Scene ID")
  unique(payload.assetSlots.map((item) => item.id), "AssetSlot ID")
  unique(payload.assets.map((item) => item.id), "Asset ID")

  const templates = new Set(payload.templates.map((item) => item.id))
  const versions = new Set(payload.templateVersions.map((item) => item.id))
  const episodes = new Set(payload.episodes.map((item) => item.id))
  const batches = new Set(payload.sceneImportBatches.map((item) => item.id))
  const scenes = new Set(payload.scenes.map((item) => item.id))
  const slots = new Set(payload.assetSlots.map((item) => item.id))
  const sceneById = new Map(payload.scenes.map((item) => [item.id, item]))
  const batchById = new Map(payload.sceneImportBatches.map((item) => [item.id, item]))
  const acceptedBySlot = new Set(payload.assets.filter((item) => item.archivedAt === null && item.status === "accepted").map((item) => item.assetSlotId))
  for (const version of payload.templateVersions) if (!templates.has(version.templateId)) throw new DomainError("BACKUP_INVALID", "TemplateVersion tham chiếu Template không tồn tại.")
  for (const batch of payload.sceneImportBatches) {
    if (!episodes.has(batch.episodeId) || !versions.has(batch.templateVersionId)) throw new DomainError("BACKUP_INVALID", "SceneImportBatch có reference không hợp lệ.")
  }
  for (const scene of payload.scenes) {
    const batch = scene.sourceImportBatchId ? batchById.get(scene.sourceImportBatchId) : null
    if (!episodes.has(scene.episodeId) || (scene.sourceImportBatchId && (!batch || batch.episodeId !== scene.episodeId))) {
      throw new DomainError("BACKUP_INVALID", "Scene có reference không hợp lệ.")
    }
  }
  for (const slot of payload.assetSlots) {
    const scene = sceneById.get(slot.sceneId)
    if (!episodes.has(slot.episodeId) || !scenes.has(slot.sceneId) || scene?.episodeId !== slot.episodeId) throw new DomainError("BACKUP_INVALID", "AssetSlot có reference không hợp lệ.")
    if (!canonicalNamePattern.test(slot.canonicalName) || normalizeKey(slot.canonicalName) !== slot.canonicalNameKey) {
      throw new DomainError("BACKUP_INVALID", "Canonical name của AssetSlot không hợp lệ.")
    }
    const expectedCanonical = `scene-${String(scene.canonicalNo).padStart(2, "0")}-${String(slot.slotOrder).padStart(2, "0")}`
    if (slot.canonicalName !== expectedCanonical) throw new DomainError("BACKUP_INVALID", "Canonical name không khớp Scene/slot order.")
    const expectedStatus = scene.status !== "approved" || !slot.prompt.trim()
      ? "draft"
      : acceptedBySlot.has(slot.id) ? "fulfilled" : "ready"
    if (slot.status !== expectedStatus) throw new DomainError("BACKUP_INVALID", "AssetSlot status không khớp Scene/Asset lifecycle.")
  }
  for (const asset of payload.assets) {
    if (!slots.has(asset.assetSlotId)) throw new DomainError("BACKUP_INVALID", "Asset tham chiếu AssetSlot không tồn tại.")
    for (const path of [asset.relativePath, asset.previewRelativePath]) {
      if (path && (/^(?:[a-zA-Z]:[\\/]|[\\/]{1,2})/.test(path) || path.split(/[\\/]/).includes(".."))) {
        throw new DomainError("BACKUP_INVALID", "Asset chứa relative path không an toàn.")
      }
    }
  }
  for (const episode of payload.episodes) {
    const path = episode.thumbnailRelativePath
    if (path && (/^(?:[a-zA-Z]:[\\/]|[\\/]{1,2})/.test(path) || path.split(/[\\/]/).includes(".."))) {
      throw new DomainError("BACKUP_INVALID", "Episode chứa thumbnail path không an toàn.")
    }
  }

  unique(payload.templates.map((item) => item.nameKey), "Template name")
  unique(payload.episodes.map((item) => item.slugKey), "Episode slug")
  unique(payload.scenes.map((item) => `${item.episodeId}:${item.displayOrder}`), "Scene display order")
  unique(payload.scenes.map((item) => `${item.episodeId}:${item.canonicalNo}`), "Scene canonical number")
  unique(payload.assetSlots.map((item) => `${item.sceneId}:${item.slotOrder}`), "AssetSlot order")
  unique(payload.assetSlots.map((item) => `${item.episodeId}:${item.canonicalNameKey}`), "AssetSlot canonical name")
  unique(payload.assets.filter((item) => item.archivedAt === null && item.relativePath).map((item) => item.relativePath!), "Active Asset path")
  unique(payload.assets.filter((item) => item.archivedAt === null && item.status === "accepted").map((item) => item.assetSlotId), "Accepted AssetSlot")
  unique(payload.templateVersions.map((item) => `${item.templateId}:${item.major}:${item.minor}`), "Template version")
}

export class MetadataBackupService {
  private readonly backupRepository: MetadataBackupRepository
  private readonly templates: TemplateRepository
  private readonly episodes: EpisodeRepository
  private readonly scenes: SceneRepository
  private readonly slots: AssetSlotRepository
  private readonly assets: AssetRepository

  constructor(
    private readonly database: StudioDatabase,
    private readonly appVersion: string,
  ) {
    this.backupRepository = new MetadataBackupRepository(database)
    this.templates = new TemplateRepository(database)
    this.episodes = new EpisodeRepository(database)
    this.scenes = new SceneRepository(database)
    this.slots = new AssetSlotRepository(database)
    this.assets = new AssetRepository(database)
  }

  exportTo(destinationPath: string) {
    const payload = this.database.transaction(() => this.backupRepository.readPayload())
    const document: MetadataBackupDocument = {
      format: "ngoday-studio-metadata",
      formatVersion: 1,
      databaseSchemaVersion: 1,
      appVersion: this.appVersion,
      createdAt: nowUtc(),
      payloadHash: sha256(canonicalJson(payload)),
      payload,
    }
    if (existsSync(destinationPath)) {
      throw new DomainError("FILE_OPERATION_FAILED", "File backup đã tồn tại. Hãy chọn tên mới để tránh ghi đè.")
    }
    const temporaryPath = resolve(dirname(destinationPath), `.${basename(destinationPath)}.${newId()}.partial`)
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
      renameSync(temporaryPath, destinationPath)
    } catch (error) {
      try { rmSync(temporaryPath, { force: true }) } catch { /* Preserve primary error. */ }
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
      throw new DomainError(
        "FILE_OPERATION_FAILED",
        code === "ENOSPC" ? "Ổ đĩa không đủ dung lượng để tạo backup." : "Không thể ghi file metadata backup.",
        { cause: error },
      )
    }
    return { fileName: basename(destinationPath), summary: summary(payload) }
  }

  restoreFrom(sourcePath: string) {
    if (this.backupRepository.businessRowCount() !== 0) {
      throw new DomainError("INVALID_TRANSITION", "Chỉ có thể restore vào database business trống; dữ liệu hiện tại không bị overwrite hoặc reset.")
    }
    let document: MetadataBackupDocument
    try {
      const fileStats = statSync(sourcePath)
      if (!fileStats.isFile() || fileStats.size <= 0 || fileStats.size > maxBackupBytes) {
        throw new DomainError("BACKUP_INVALID", "File backup rỗng hoặc vượt giới hạn metadata 50 MiB.")
      }
      document = metadataBackupDocumentSchema.parse(JSON.parse(readFileSync(sourcePath, "utf8")))
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw new DomainError("BACKUP_INVALID", "File không đúng strict metadata backup v1.", { cause: error })
    }
    if (sha256(canonicalJson(document.payload)) !== document.payloadHash) {
      throw new DomainError("BACKUP_INVALID", "Checksum metadata backup không khớp.")
    }
    assertReferences(document.payload)

    this.database.transaction(() => {
      if (this.backupRepository.businessRowCount() !== 0) throw new DomainError("INVALID_TRANSITION", "Database không còn trống.")
      this.insertPayload(document.payload)
      const expectedRows = Object.values(document.payload).reduce((total, items) => total + items.length, 0)
      if (this.backupRepository.businessRowCount() !== expectedRows) throw new DomainError("BACKUP_INVALID", "Số record sau restore không khớp backup.")
      const foreignKeys = this.database.connection.prepare("PRAGMA foreign_key_check").all()
      if (foreignKeys.length > 0) throw new DomainError("BACKUP_INVALID", "Backup không vượt qua foreign-key check.")
      const check = this.database.connection.prepare("PRAGMA quick_check").get() as { quick_check?: string } | undefined
      if (check?.quick_check !== "ok") throw new DomainError("BACKUP_INVALID", "Database không vượt qua integrity check sau restore.")
    })
    return { fileName: basename(sourcePath), summary: summary(document.payload) }
  }

  private insertPayload(payload: MetadataBackupPayload) {
    const versionsByTemplate = new Map<string, TemplateVersion[]>()
    for (const version of payload.templateVersions) {
      const versions = versionsByTemplate.get(version.templateId) ?? []
      versions.push(version)
      versionsByTemplate.set(version.templateId, versions)
    }
    for (const template of payload.templates) {
      const versions = versionsByTemplate.get(template.id) ?? []
      if (versions.length === 0) throw new DomainError("BACKUP_INVALID", "Template trong backup không có version.")
      this.templates.insert(template as Template, versions[0]!)
      for (const version of versions.slice(1)) this.templates.insertVersion(version)
    }
    for (const episode of payload.episodes) this.episodes.insert(episode as Episode)
    for (const batch of payload.sceneImportBatches) this.scenes.insertImportBatch(batch as SceneImportBatch)
    this.scenes.insertMany(payload.scenes as Scene[])
    this.slots.insertMany(payload.assetSlots as AssetSlot[])
    for (const asset of payload.assets) this.assets.insert(asset as Asset)
  }
}
