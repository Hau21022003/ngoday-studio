import { existsSync, readFileSync, statSync } from "node:fs"
import { basename, isAbsolute, relative, resolve, sep } from "node:path"

import type {
  Asset,
  AssetFileIntegrity,
  AssetListQuery,
  AssetProjection,
  AssetTransitionCommand,
  RegisterImportedAssetCommand,
} from "../../shared/domain"
import { DomainError, NotFoundError, StaleRevisionError } from "../domain/errors"
import { newId, nowUtc, sha256 } from "../domain/helpers"
import type { StudioDatabase } from "../persistence/database"
import { AssetRepository, type AssetRecordProjection } from "../persistence/repositories/asset-repository"
import { AssetSlotRepository } from "../persistence/repositories/asset-slot-repository"
import { SceneRepository } from "../persistence/repositories/scene-repository"
import { rethrowSqliteConstraint } from "../persistence/sqlite-errors"

export class AssetService {
  private readonly resolvedWorkspaceRoot: string

  constructor(
    private readonly database: StudioDatabase,
    private readonly workspaceRoot: string,
    private readonly scenes: SceneRepository,
    private readonly slots: AssetSlotRepository,
    private readonly assets: AssetRepository,
  ) {
    this.resolvedWorkspaceRoot = resolve(workspaceRoot)
  }

  list(query: AssetListQuery) {
    const page = this.assets.listByEpisode(query)
    return { ...page, items: page.items.map((record) => this.project(record)) }
  }

  get(id: string) {
    const record = this.assets.getById(id)
    if (!record) throw new NotFoundError("Asset")
    return this.project(record)
  }

  fileIntegrity(id: string): AssetFileIntegrity {
    const record = this.assets.getById(id)
    if (!record) return "unattached"
    return this.integrity(record.asset)
  }

  registerImported(command: RegisterImportedAssetCommand): AssetProjection {
    const slot = this.slots.getById(command.assetSlotId)
    if (!slot) throw new NotFoundError("AssetSlot")
    if (slot.revisionNo !== command.expectedAssetSlotRevisionNo) throw new StaleRevisionError("AssetSlot")
    const relativePath = this.assertWorkspaceFile(command.sourcePath)
    const absolutePath = resolve(this.resolvedWorkspaceRoot, relativePath)
    const stats = statSync(absolutePath)
    const actualHash = sha256(readFileSync(absolutePath))
    if (stats.size !== command.bytes || actualHash !== command.sha256) {
      throw new DomainError("VALIDATION_ERROR", "Metadata file không khớp file trong workspace.")
    }
    const previewRelativePath = command.previewSourcePath
      ? this.assertWorkspaceFile(command.previewSourcePath)
      : null
    const now = nowUtc()
    const asset: Asset = {
      id: newId(),
      assetSlotId: slot.id,
      status: "candidate",
      origin: "imported",
      promptSnapshot: command.promptSnapshot,
      relativePath,
      previewRelativePath,
      fileName: basename(relativePath),
      mimeType: command.mimeType,
      bytes: stats.size,
      sha256: actualHash,
      width: command.width ?? null,
      height: command.height ?? null,
      durationMs: command.durationMs ?? null,
      revisionNo: 1,
      createdAt: now,
      acceptedAt: null,
      rejectedAt: null,
      archivedAt: null,
    }
    try {
      this.database.transaction(() => {
        const current = this.slots.getById(slot.id)
        if (!current || current.revisionNo !== command.expectedAssetSlotRevisionNo) throw new StaleRevisionError("AssetSlot")
        this.assets.insert(asset)
        this.slots.update({ ...current, updatedAt: now }, command.expectedAssetSlotRevisionNo)
      })
      return this.get(asset.id)
    } catch (error) {
      rethrowSqliteConstraint(error)
    }
  }

  accept(command: AssetTransitionCommand) {
    const record = this.assets.getById(command.id)
    if (!record) throw new NotFoundError("Asset")
    if (record.asset.revisionNo !== command.expectedRevisionNo) throw new StaleRevisionError("Asset")
    if (record.asset.status === "accepted") throw new DomainError("INVALID_TRANSITION", "Asset đã được accepted.")
    if (record.slot.status === "draft") {
      throw new DomainError("INVALID_TRANSITION", "AssetSlot phải ready trước khi accept Asset.")
    }
    if (this.integrity(record.asset) !== "available") {
      throw new DomainError("INVALID_TRANSITION", "Không thể accept Asset khi file chưa hợp lệ.")
    }
    const now = nowUtc()
    this.database.transaction(() => {
      const slot = this.slots.getById(record.slot.id)
      if (!slot) throw new NotFoundError("AssetSlot")
      if (slot.status === "draft") {
        throw new DomainError("INVALID_TRANSITION", "AssetSlot phải ready trước khi accept Asset.")
      }
      this.assets.rejectAcceptedForSlot(slot.id, record.asset.id, now)
      this.assets.transition(record.asset.id, "accepted", command.expectedRevisionNo, now)
      this.slots.setStatus(slot.id, "fulfilled", slot.revisionNo, now)
    })
    return this.get(record.asset.id)
  }

  reject(command: AssetTransitionCommand) {
    const record = this.assets.getById(command.id)
    if (!record) throw new NotFoundError("Asset")
    if (record.asset.status === "rejected") throw new DomainError("INVALID_TRANSITION", "Asset đã bị rejected.")
    const now = nowUtc()
    this.database.transaction(() => {
      this.assets.transition(record.asset.id, "rejected", command.expectedRevisionNo, now)
      this.refreshSlot(record.slot.id, now)
    })
    return this.get(record.asset.id)
  }

  archive(command: AssetTransitionCommand) {
    const record = this.assets.getById(command.id)
    if (!record) throw new NotFoundError("Asset")
    const now = nowUtc()
    this.database.transaction(() => {
      this.assets.archive(record.asset.id, command.expectedRevisionNo, now)
      this.refreshSlot(record.slot.id, now)
    })
    return { id: record.asset.id }
  }

  private project(record: AssetRecordProjection): AssetProjection {
    return { ...record.asset, fileIntegrity: this.integrity(record.asset), slot: record.slot, scene: record.scene }
  }

  private integrity(asset: Asset): AssetFileIntegrity {
    if (!asset.relativePath) return "unattached"
    let absolutePath: string
    try {
      absolutePath = this.resolveWithinWorkspace(asset.relativePath)
    } catch {
      return "missing"
    }
    if (!existsSync(absolutePath)) return "missing"
    if (asset.sha256 && sha256(readFileSync(absolutePath)) !== asset.sha256) return "hash_mismatch"
    return "available"
  }

  private assertWorkspaceFile(input: string) {
    if (isAbsolute(input)) throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Chỉ chấp nhận relative path trong workspace.")
    const absolutePath = this.resolveWithinWorkspace(input)
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      throw new DomainError("VALIDATION_ERROR", "File không tồn tại trong workspace.")
    }
    return relative(this.resolvedWorkspaceRoot, absolutePath).split(sep).join("/")
  }

  private resolveWithinWorkspace(input: string) {
    const resolved = resolve(this.resolvedWorkspaceRoot, input)
    if (resolved !== this.resolvedWorkspaceRoot && !resolved.startsWith(`${this.resolvedWorkspaceRoot}${sep}`)) {
      throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Path nằm ngoài workspace.")
    }
    return resolved
  }

  private refreshSlot(slotId: string, at: string) {
    const slot = this.slots.getById(slotId)
    if (!slot) throw new NotFoundError("AssetSlot")
    const scene = this.scenes.getById(slot.sceneId)
    if (!scene) throw new NotFoundError("Scene")
    const status = scene.status !== "approved" || !slot.prompt.trim()
      ? "draft"
      : this.assets.hasAcceptedForSlot(slot.id)
        ? "fulfilled"
        : "ready"
    if (status !== slot.status) this.slots.setStatus(slot.id, status, slot.revisionNo, at)
  }
}
