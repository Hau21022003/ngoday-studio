import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { resolve, sep } from "node:path"

import type {
  EpisodeThumbnailContent,
  ImportEpisodeThumbnailCommand,
  ReadEpisodeThumbnailCommand,
} from "../../shared/domain"
import { DomainError } from "../domain/errors"
import { newId, sha256 } from "../domain/helpers"

const maxThumbnailBytes = 5 * 1024 * 1024

const extensions = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const

function matchesSignature(bytes: Uint8Array, mimeType: keyof typeof extensions) {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  }
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
}

export class EpisodeThumbnailService {
  private readonly resolvedWorkspaceRoot: string
  private readonly thumbnailDirectory: string

  constructor(workspaceRoot: string) {
    const configuredWorkspaceRoot = resolve(workspaceRoot)
    mkdirSync(configuredWorkspaceRoot, { recursive: true })
    this.resolvedWorkspaceRoot = realpathSync(configuredWorkspaceRoot)
    const configuredThumbnailDirectory = resolve(this.resolvedWorkspaceRoot, "thumbnails")
    mkdirSync(configuredThumbnailDirectory, { recursive: true })
    this.thumbnailDirectory = realpathSync(configuredThumbnailDirectory)
    if (!this.thumbnailDirectory.startsWith(`${this.resolvedWorkspaceRoot}${sep}`)) {
      throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Thư mục thumbnail nằm ngoài workspace.")
    }
  }

  import(command: ImportEpisodeThumbnailCommand): EpisodeThumbnailContent {
    const bytes = Buffer.from(command.dataBase64, "base64")
    if (bytes.length === 0 || bytes.length > maxThumbnailBytes) {
      throw new DomainError("VALIDATION_ERROR", "Thumbnail phải có dung lượng từ 1 byte đến 5 MiB.", {
        fieldErrors: { dataBase64: "Dung lượng thumbnail không hợp lệ." },
      })
    }
    if (!matchesSignature(bytes, command.mimeType)) {
      throw new DomainError("VALIDATION_ERROR", "Nội dung thumbnail không khớp định dạng đã khai báo.", {
        fieldErrors: { mimeType: "Định dạng ảnh không hợp lệ." },
      })
    }

    const relativePath = `thumbnails/${sha256(bytes)}.${extensions[command.mimeType]}`
    const destination = this.resolveThumbnail(relativePath)
    if (!existsSync(destination)) {
      const temporary = resolve(this.thumbnailDirectory, `.${newId()}.tmp`)
      try {
        writeFileSync(temporary, bytes, { flag: "wx" })
        renameSync(temporary, destination)
      } catch (error) {
        if (existsSync(temporary)) unlinkSync(temporary)
        throw error
      }
    }
    return this.content(relativePath, command.mimeType, bytes)
  }

  read(command: ReadEpisodeThumbnailCommand): EpisodeThumbnailContent {
    const absolutePath = this.resolveThumbnail(command.relativePath)
    if (!existsSync(absolutePath)) throw new DomainError("NOT_FOUND", "Không tìm thấy thumbnail Episode.")
    const bytes = readFileSync(absolutePath)
    if (bytes.length === 0 || bytes.length > maxThumbnailBytes) {
      throw new DomainError("VALIDATION_ERROR", "Thumbnail trong workspace có dung lượng không hợp lệ.")
    }
    const mimeType = command.relativePath.endsWith(".png")
      ? "image/png"
      : command.relativePath.endsWith(".jpg") || command.relativePath.endsWith(".jpeg")
        ? "image/jpeg"
        : command.relativePath.endsWith(".webp")
          ? "image/webp"
          : null
    if (!mimeType || !matchesSignature(bytes, mimeType)) {
      throw new DomainError("VALIDATION_ERROR", "Thumbnail trong workspace không phải ảnh được hỗ trợ.")
    }
    return this.content(command.relativePath.replace(/\\/g, "/"), mimeType, bytes)
  }

  private content(
    relativePath: string,
    mimeType: keyof typeof extensions,
    bytes: Uint8Array,
  ): EpisodeThumbnailContent {
    return {
      relativePath,
      mimeType,
      dataUrl: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
    }
  }

  private resolveThumbnail(relativePath: string) {
    const normalized = relativePath.replace(/\\/g, "/")
    if (!normalized.startsWith("thumbnails/") || normalized.includes("..")) {
      throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Thumbnail phải nằm trong thư mục thumbnail của workspace.")
    }
    const resolved = resolve(this.resolvedWorkspaceRoot, normalized)
    if (!resolved.startsWith(`${this.thumbnailDirectory}${sep}`)) {
      throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Thumbnail nằm ngoài workspace.")
    }
    if (!existsSync(resolved)) return resolved
    const actual = realpathSync(resolved)
    if (!actual.startsWith(`${this.thumbnailDirectory}${sep}`)) {
      throw new DomainError("FILE_OUTSIDE_WORKSPACE", "Thumbnail nằm ngoài workspace.")
    }
    return actual
  }
}
