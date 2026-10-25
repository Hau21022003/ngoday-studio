import { createHash } from "node:crypto"
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  statfsSync,
  statSync,
} from "node:fs"
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path"
import { pipeline } from "node:stream/promises"

import type {
  Asset,
  AssetFileIntegrity,
  AssetListQuery,
  AssetProjection,
  AssetTransitionCommand,
  ImportAssetFileCommand,
} from "../../shared/domain"
import { DomainError, NotFoundError, StaleRevisionError } from "../domain/errors"
import { newId, nowUtc } from "../domain/helpers"
import type { StudioDatabase } from "../persistence/database"
import { AssetRepository, type AssetRecordProjection } from "../persistence/repositories/asset-repository"
import { AssetSlotRepository } from "../persistence/repositories/asset-slot-repository"
import { SceneRepository } from "../persistence/repositories/scene-repository"
import { rethrowSqliteConstraint } from "../persistence/sqlite-errors"

const hashBufferSize = 1024 * 1024
const diskHeadroomBytes = 16n * 1024n * 1024n

type SupportedFile = {
  mediaType: "image" | "video"
  mimeType: string
  extensions: readonly string[]
}

const supportedFiles: readonly SupportedFile[] = [
  { mediaType: "image", mimeType: "image/png", extensions: [".png"] },
  { mediaType: "image", mimeType: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  { mediaType: "image", mimeType: "image/webp", extensions: [".webp"] },
  { mediaType: "video", mimeType: "video/mp4", extensions: [".mp4"] },
  { mediaType: "video", mimeType: "video/webm", extensions: [".webm"] },
  { mediaType: "video", mimeType: "video/quicktime", extensions: [".mov"] },
]

function startsWithBytes(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

function detectFile(bytes: Uint8Array, extension: string): SupportedFile | null {
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return supportedFiles[0]!
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return supportedFiles[1]!
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return supportedFiles[2]!
  if (startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return supportedFiles[4]!
  if (String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    return extension === ".mov" ? supportedFiles[5]! : supportedFiles[3]!
  }
  return null
}

function inspectFile(path: string) {
  const handle = openSync(path, "r")
  try {
    const header = Buffer.alloc(16)
    const bytesRead = readSync(handle, header, 0, header.length, 0)
    const extension = extname(path).toLocaleLowerCase("en-US")
    const detected = detectFile(header.subarray(0, bytesRead), extension)
    if (!detected || !detected.extensions.includes(extension)) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "File phải là PNG, JPEG, WebP, MP4, WebM hoặc MOV hợp lệ và phần mở rộng phải khớp nội dung.",
      )
    }
    return detected
  } finally {
    closeSync(handle)
  }
}

function sanitizeFileName(value: string) {
  const sanitized = value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 180)
  return sanitized || "asset"
}

function sha256FileSync(path: string) {
  const hash = createHash("sha256")
  const handle = openSync(path, "r")
  const buffer = Buffer.allocUnsafe(hashBufferSize)
  try {
    let bytesRead = 0
    do {
      bytesRead = readSync(handle, buffer, 0, buffer.length, null)
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead))
    } while (bytesRead > 0)
  } finally {
    closeSync(handle)
  }
  return hash.digest("hex")
}

function fileOperationError(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
  if (code === "ENOSPC") return new DomainError("FILE_OPERATION_FAILED", "Ổ đĩa không còn đủ dung lượng để import file.", { cause: error })
  return error instanceof DomainError
    ? error
    : new DomainError("FILE_OPERATION_FAILED", fallback, { cause: error })
}

export class AssetService {
  private readonly resolvedWorkspaceRoot: string
  private readonly realWorkspaceRoot: string

  constructor(
    private readonly database: StudioDatabase,
    workspaceRoot: string,
    private readonly scenes: SceneRepository,
    private readonly slots: AssetSlotRepository,
    private readonly assets: AssetRepository,
  ) {
    this.resolvedWorkspaceRoot = resolve(workspaceRoot)
    mkdirSync(this.resolvedWorkspaceRoot, { recursive: true })
    this.realWorkspaceRoot = realpathSync(this.resolvedWorkspaceRoot)
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

  verifyIntegrity(id: string) {
    return this.get(id)
  }

  fileIntegrity(id: string): AssetFileIntegrity {
    const record = this.assets.getById(id)
    if (!record) return "unattached"
    return this.integrity(record.asset)
  }

  async importFile(command: ImportAssetFileCommand, sourcePath: string): Promise<AssetProjection> {
    const slot = this.slots.getById(command.assetSlotId)
    if (!slot) throw new NotFoundError("AssetSlot")
    if (slot.revisionNo !== command.expectedAssetSlotRevisionNo) throw new StaleRevisionError("AssetSlot")
    if (!isAbsolute(sourcePath)) throw new DomainError("VALIDATION_ERROR", "File được chọn phải có đường dẫn tuyệt đối từ native dialog.")

    let sourceStats
    try {
      const sourceLstat = lstatSync(sourcePath)
      if (sourceLstat.isSymbolicLink() || !sourceLstat.isFile()) {
        throw new DomainError("VALIDATION_ERROR", "Chỉ có thể import file thường, không chấp nhận symbolic link.")
      }
      sourceStats = statSync(realpathSync(sourcePath))
    } catch (error) {
      throw fileOperationError(error, "Không thể đọc file nguồn đã chọn.")
    }
    if (sourceStats.size <= 0) throw new DomainError("VALIDATION_ERROR", "Không thể import file rỗng.")

    const detected = inspectFile(sourcePath)
    if (detected.mediaType !== slot.mediaType) {
      throw new DomainError("VALIDATION_ERROR", `AssetSlot yêu cầu ${slot.mediaType} nhưng file đã chọn là ${detected.mediaType}.`)
    }
    this.assertDiskSpace(sourceStats.size)

    const assetId = newId()
    const safeName = sanitizeFileName(basename(sourcePath))
    const configuredAssetDirectory = this.resolveWithinWorkspace(`assets/${slot.episodeId}/${slot.id}/${assetId}`)
    this.assertManagedAssetPath(configuredAssetDirectory)
    mkdirSync(configuredAssetDirectory, { recursive: true })
    const assetDirectory = realpathSync(configuredAssetDirectory)
    if (!this.isWithinRealWorkspace(assetDirectory)) {
      throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Managed Asset directory resolve ra ngoài workspace.")
    }
    const finalPath = resolve(assetDirectory, safeName)
    const temporaryPath = resolve(assetDirectory, `${safeName}.partial`)

    const hash = createHash("sha256")
    let copiedBytes = 0
    try {
      const reader = createReadStream(sourcePath, { flags: "r" })
      reader.on("data", (chunk: Buffer) => {
        hash.update(chunk)
        copiedBytes += chunk.length
      })
      await pipeline(reader, createWriteStream(temporaryPath, { flags: "wx" }))
      const afterCopy = statSync(sourcePath)
      if (
        copiedBytes !== sourceStats.size
        || afterCopy.size !== sourceStats.size
        || afterCopy.mtimeMs !== sourceStats.mtimeMs
      ) {
        throw new DomainError("FILE_OPERATION_FAILED", "File nguồn đã thay đổi trong lúc import; bản sao tạm đã được hủy.")
      }
      renameSync(temporaryPath, finalPath)
    } catch (error) {
      this.cleanupNewAssetDirectory(assetDirectory)
      throw fileOperationError(error, "Không thể sao chép file vào workspace.")
    }

    const actualHash = hash.digest("hex")
    if (this.assets.hasActiveHashForSlot(slot.id, actualHash)) {
      this.cleanupNewAssetDirectory(assetDirectory)
      throw new DomainError("DUPLICATE_NAME", "File này đã tồn tại như một candidate đang hoạt động trong AssetSlot.")
    }

    const now = nowUtc()
    const relativePath = relative(this.resolvedWorkspaceRoot, finalPath).split(sep).join("/")
    const asset: Asset = {
      id: assetId,
      assetSlotId: slot.id,
      status: "candidate",
      origin: "imported",
      promptSnapshot: slot.prompt,
      relativePath,
      previewRelativePath: null,
      fileName: safeName,
      mimeType: detected.mimeType,
      bytes: copiedBytes,
      sha256: actualHash,
      width: null,
      height: null,
      durationMs: null,
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
    } catch (error) {
      this.cleanupNewAssetDirectory(assetDirectory)
      rethrowSqliteConstraint(error)
    }
    return this.get(asset.id)
  }

  accept(command: AssetTransitionCommand) {
    const record = this.assets.getById(command.id)
    if (!record) throw new NotFoundError("Asset")
    if (record.asset.revisionNo !== command.expectedRevisionNo) throw new StaleRevisionError("Asset")
    if (record.asset.status === "accepted") throw new DomainError("INVALID_TRANSITION", "Asset đã được accepted.")
    if (record.slot.status === "draft") throw new DomainError("INVALID_TRANSITION", "AssetSlot phải ready trước khi accept Asset.")
    if (this.integrity(record.asset) !== "available") {
      throw new DomainError("INVALID_TRANSITION", "Không thể accept Asset khi file chưa hợp lệ.")
    }
    const now = nowUtc()
    this.database.transaction(() => {
      const slot = this.slots.getById(record.slot.id)
      if (!slot) throw new NotFoundError("AssetSlot")
      if (slot.status === "draft") throw new DomainError("INVALID_TRANSITION", "AssetSlot phải ready trước khi accept Asset.")
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

  registeredFilePath(id: string) {
    const record = this.assets.getById(id)
    if (!record) throw new NotFoundError("Asset")
    if (!record.asset.relativePath) throw new DomainError("FILE_OPERATION_FAILED", "Asset chưa có file đính kèm.")
    const path = this.resolveWithinWorkspace(record.asset.relativePath)
    if (!existsSync(path) || !lstatSync(path).isFile()) {
      throw new DomainError("FILE_OPERATION_FAILED", "File Asset không còn tồn tại trong workspace.")
    }
    const realPath = realpathSync(path)
    if (!this.isWithinRealWorkspace(realPath)) throw new DomainError("FILE_OUTSIDE_WORKSPACE", "File Asset nằm ngoài workspace.")
    return realPath
  }

  private project(record: AssetRecordProjection): AssetProjection {
    return { ...record.asset, fileIntegrity: this.integrity(record.asset), slot: record.slot, scene: record.scene }
  }

  private integrity(asset: Asset): AssetFileIntegrity {
    if (!asset.relativePath) return "unattached"
    try {
      const absolutePath = this.resolveWithinWorkspace(asset.relativePath)
      if (!existsSync(absolutePath)) return "missing"
      const fileStats = lstatSync(absolutePath)
      if (!fileStats.isFile() || fileStats.isSymbolicLink()) return "missing"
      const realPath = realpathSync(absolutePath)
      if (!this.isWithinRealWorkspace(realPath)) return "missing"
      if (asset.bytes !== null && fileStats.size !== asset.bytes) return "hash_mismatch"
      if (asset.sha256 && sha256FileSync(realPath) !== asset.sha256) return "hash_mismatch"
      return "available"
    } catch {
      return "missing"
    }
  }

  private assertDiskSpace(bytes: number) {
    try {
      const stats = statfsSync(this.realWorkspaceRoot, { bigint: true })
      const available = stats.bavail * stats.bsize
      if (available < BigInt(bytes) + diskHeadroomBytes) {
        throw new DomainError("FILE_OPERATION_FAILED", "Workspace không còn đủ dung lượng trống để import file an toàn.")
      }
    } catch (error) {
      if (error instanceof DomainError) throw error
      // Some filesystems do not expose free-space information. Copy still fails closed on ENOSPC.
    }
  }

  private cleanupNewAssetDirectory(assetDirectory: string) {
    this.assertManagedAssetPath(assetDirectory)
    try {
      rmSync(assetDirectory, { recursive: true, force: true })
    } catch {
      // Preserve the primary import error. The unique directory is never reused.
    }
  }

  private assertManagedAssetPath(path: string) {
    const assetsRoot = resolve(this.resolvedWorkspaceRoot, "assets")
    if (!path.startsWith(`${assetsRoot}${sep}`)) {
      throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Asset path nằm ngoài managed workspace.")
    }
  }

  private resolveWithinWorkspace(input: string) {
    const resolved = resolve(this.resolvedWorkspaceRoot, input)
    if (resolved !== this.resolvedWorkspaceRoot && !resolved.startsWith(`${this.resolvedWorkspaceRoot}${sep}`)) {
      throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Path nằm ngoài workspace.")
    }
    return resolved
  }

  private isWithinRealWorkspace(input: string) {
    return input === this.realWorkspaceRoot || input.startsWith(`${this.realWorkspaceRoot}${sep}`)
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
