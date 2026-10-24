import type { Asset, AssetListQuery, AssetSlot, Page, Scene } from "../../../shared/domain"
import { StaleRevisionError } from "../../domain/errors"
import type { StudioDatabase } from "../database"
import { mapAsset, mapAssetSlot, mapScene, type SqlRow } from "../row-mappers"

export type AssetRecordProjection = {
  asset: Asset
  slot: AssetSlot
  scene: Pick<Scene, "id" | "title" | "canonicalNo" | "sceneType">
}

const assetSelect = `
  SELECT
    asset.*,
    slot.id AS slot__id,
    slot.episode_id AS slot__episode_id,
    slot.scene_id AS slot__scene_id,
    slot.slot_order AS slot__slot_order,
    slot.canonical_name AS slot__canonical_name,
    slot.canonical_name_key AS slot__canonical_name_key,
    slot.media_type AS slot__media_type,
    slot.prompt AS slot__prompt,
    slot.required AS slot__required,
    slot.status AS slot__status,
    slot.revision_no AS slot__revision_no,
    slot.created_at AS slot__created_at,
    slot.updated_at AS slot__updated_at,
    scene.id AS scene__id,
    scene.title AS scene__title,
    scene.canonical_no AS scene__canonical_no,
    scene.scene_type AS scene__scene_type
  FROM assets asset
  JOIN asset_slots slot ON slot.id = asset.asset_slot_id
  JOIN scenes scene ON scene.id = slot.scene_id
`

function prefixed(row: SqlRow, prefix: string): SqlRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  )
}

function mapRecord(row: SqlRow): AssetRecordProjection {
  const sceneId = row.scene__id
  const title = row.scene__title
  const canonicalNo = row.scene__canonical_no
  const sceneType = row.scene__scene_type
  if (typeof sceneId !== "string" || typeof title !== "string" || typeof canonicalNo !== "number" || typeof sceneType !== "string") {
    throw new TypeError("Invalid scene projection row.")
  }
  return {
    asset: mapAsset(row),
    slot: mapAssetSlot(prefixed(row, "slot__")),
    scene: { id: sceneId, title, canonicalNo, sceneType: mapSceneType(sceneType) },
  }
}

function mapSceneType(value: string): Scene["sceneType"] {
  if (["MAIN_CHARACTER", "ENVIRONMENT", "SCIENTIFIC_VISUALIZATION", "MOTION_GRAPHIC", "B_ROLL"].includes(value)) {
    return value as Scene["sceneType"]
  }
  throw new TypeError("Invalid scene type projection.")
}

export class AssetRepository {
  constructor(private readonly database: StudioDatabase) {}

  listByEpisode(query: AssetListQuery): Page<AssetRecordProjection> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 24
    const conditions = ["slot.episode_id = ?", "asset.archived_at IS NULL"]
    const values: Array<string | number> = [query.episodeId]
    if (query.search?.trim()) {
      conditions.push("(scene.title LIKE ? ESCAPE '\\' OR slot.canonical_name LIKE ? ESCAPE '\\' OR asset.file_name LIKE ? ESCAPE '\\')")
      const escaped = query.search.trim().replace(/[\\%_]/g, "\\$&")
      values.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`)
    }
    if (query.mediaType) {
      conditions.push("slot.media_type = ?")
      values.push(query.mediaType)
    }
    if (query.status) {
      conditions.push("asset.status = ?")
      values.push(query.status)
    }
    const where = `WHERE ${conditions.join(" AND ")}`
    const totalRow = this.database.connection
      .prepare(`SELECT COUNT(*) AS total FROM assets asset JOIN asset_slots slot ON slot.id = asset.asset_slot_id JOIN scenes scene ON scene.id = slot.scene_id ${where}`)
      .get(...values) as SqlRow
    const rows = this.database.connection
      .prepare(`${assetSelect} ${where} ORDER BY scene.display_order, slot.slot_order, asset.created_at DESC LIMIT ? OFFSET ?`)
      .all(...values, pageSize, (page - 1) * pageSize) as SqlRow[]
    return { items: rows.map(mapRecord), page, pageSize, total: Number(totalRow.total) }
  }

  getById(id: string): AssetRecordProjection | null {
    const row = this.database.connection
      .prepare(`${assetSelect} WHERE asset.id = ?`)
      .get(id) as SqlRow | undefined
    return row ? mapRecord(row) : null
  }

  hasAcceptedForSlot(assetSlotId: string) {
    return Boolean(
      this.database.connection
        .prepare("SELECT 1 AS found FROM assets WHERE asset_slot_id = ? AND status = 'accepted' AND archived_at IS NULL")
        .get(assetSlotId),
    )
  }

  insert(asset: Asset) {
    this.database.connection
      .prepare(`
        INSERT INTO assets (
          id, asset_slot_id, status, origin, prompt_snapshot, relative_path,
          preview_relative_path, file_name, mime_type, bytes, sha256, width, height,
          duration_ms, revision_no, created_at, accepted_at, rejected_at, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        asset.id,
        asset.assetSlotId,
        asset.status,
        asset.origin,
        asset.promptSnapshot,
        asset.relativePath,
        asset.previewRelativePath,
        asset.fileName,
        asset.mimeType,
        asset.bytes,
        asset.sha256,
        asset.width,
        asset.height,
        asset.durationMs,
        asset.revisionNo,
        asset.createdAt,
        asset.acceptedAt,
        asset.rejectedAt,
        asset.archivedAt,
      )
  }

  transition(id: string, status: Asset["status"], expectedRevisionNo: number, at: string) {
    const acceptedAt = status === "accepted" ? at : null
    const rejectedAt = status === "rejected" ? at : null
    const result = this.database.connection
      .prepare(`
        UPDATE assets
        SET status = ?, accepted_at = ?, rejected_at = ?, revision_no = revision_no + 1
        WHERE id = ? AND revision_no = ? AND archived_at IS NULL
      `)
      .run(status, acceptedAt, rejectedAt, id, expectedRevisionNo)
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Asset")
    return this.getById(id)!
  }

  rejectAcceptedForSlot(assetSlotId: string, exceptAssetId: string, at: string) {
    this.database.connection
      .prepare(`
        UPDATE assets
        SET status = 'rejected', rejected_at = ?, revision_no = revision_no + 1
        WHERE asset_slot_id = ? AND id <> ? AND status = 'accepted' AND archived_at IS NULL
      `)
      .run(at, assetSlotId, exceptAssetId)
  }

  archive(id: string, expectedRevisionNo: number, at: string) {
    const result = this.database.connection
      .prepare("UPDATE assets SET archived_at = ?, revision_no = revision_no + 1 WHERE id = ? AND revision_no = ? AND archived_at IS NULL")
      .run(at, id, expectedRevisionNo)
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Asset")
  }
}
