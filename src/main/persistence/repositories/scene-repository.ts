import type { Scene, SceneImportBatch } from "../../../shared/domain"
import { StaleRevisionError } from "../../domain/errors"
import type { StudioDatabase } from "../database"
import { mapScene, mapSceneImportBatch, type SqlRow } from "../row-mappers"

export class SceneRepository {
  constructor(private readonly database: StudioDatabase) {}

  listByEpisode(episodeId: string) {
    const rows = this.database.connection
      .prepare("SELECT * FROM scenes WHERE episode_id = ? ORDER BY display_order")
      .all(episodeId) as SqlRow[]
    return rows.map(mapScene)
  }

  getById(id: string): Scene | null {
    const row = this.database.connection.prepare("SELECT * FROM scenes WHERE id = ?").get(id) as SqlRow | undefined
    return row ? mapScene(row) : null
  }

  getImportBatchById(id: string): SceneImportBatch | null {
    const row = this.database.connection
      .prepare("SELECT * FROM scene_import_batches WHERE id = ?")
      .get(id) as SqlRow | undefined
    return row ? mapSceneImportBatch(row) : null
  }

  insertImportBatch(batch: SceneImportBatch) {
    this.database.connection
      .prepare(`
        INSERT INTO scene_import_batches (
          id, episode_id, template_version_id, mode, payload_hash, rendered_prompt_hash, scene_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        batch.id,
        batch.episodeId,
        batch.templateVersionId,
        batch.mode,
        batch.payloadHash,
        batch.renderedPromptHash,
        batch.sceneCount,
        batch.createdAt,
      )
  }

  insertMany(scenes: Scene[]) {
    const statement = this.database.connection.prepare(`
      INSERT INTO scenes (
        id, episode_id, display_order, canonical_no, title, summary, narration,
        visual_description, scene_type, default_media_type, notes, status,
        source_import_batch_id, revision_no, approved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const scene of scenes) {
      statement.run(
        scene.id,
        scene.episodeId,
        scene.displayOrder,
        scene.canonicalNo,
        scene.title,
        scene.summary,
        scene.narration,
        scene.visualDescription,
        scene.sceneType,
        scene.defaultMediaType,
        scene.notes,
        scene.status,
        scene.sourceImportBatchId,
        scene.revisionNo,
        scene.approvedAt,
        scene.createdAt,
        scene.updatedAt,
      )
    }
  }

  update(scene: Scene, expectedRevisionNo: number) {
    const result = this.database.connection
      .prepare(`
        UPDATE scenes
        SET title = ?, summary = ?, narration = ?, visual_description = ?, scene_type = ?,
            default_media_type = ?, notes = ?, status = ?, approved_at = ?,
            updated_at = ?, revision_no = revision_no + 1
        WHERE id = ? AND revision_no = ?
      `)
      .run(
        scene.title,
        scene.summary,
        scene.narration,
        scene.visualDescription,
        scene.sceneType,
        scene.defaultMediaType,
        scene.notes,
        scene.status,
        scene.approvedAt,
        scene.updatedAt,
        scene.id,
        expectedRevisionNo,
      )
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Scene")
    return this.getById(scene.id)!
  }

  bumpRevision(id: string, expectedRevisionNo: number, at: string) {
    const result = this.database.connection
      .prepare("UPDATE scenes SET revision_no = revision_no + 1, updated_at = ? WHERE id = ? AND revision_no = ?")
      .run(at, id, expectedRevisionNo)
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Scene")
    return this.getById(id)!
  }

  replaceDisplayOrder(episodeId: string, orderedIds: string[]) {
    const existing = this.listByEpisode(episodeId)
    const currentIds = new Set(existing.map((scene) => scene.id))
    if (currentIds.size !== orderedIds.length || orderedIds.some((id) => !currentIds.has(id))) {
      throw new StaleRevisionError("Danh sách Scene")
    }
    const maxOrder = Math.max(0, ...existing.map((scene) => scene.displayOrder))
    const temporaryOffset = maxOrder + orderedIds.length + 1_000
    this.database.connection
      .prepare("UPDATE scenes SET display_order = display_order + ? WHERE episode_id = ?")
      .run(temporaryOffset, episodeId)
    const statement = this.database.connection.prepare(
      "UPDATE scenes SET display_order = ?, updated_at = ?, revision_no = revision_no + 1 WHERE id = ? AND episode_id = ?",
    )
    const now = new Date().toISOString()
    orderedIds.forEach((id, index) => statement.run(index + 1, now, id, episodeId))
    return this.listByEpisode(episodeId)
  }

  maxCanonicalNo(episodeId: string) {
    const row = this.database.connection
      .prepare("SELECT COALESCE(MAX(canonical_no), 0) AS max_no FROM scenes WHERE episode_id = ?")
      .get(episodeId) as SqlRow
    return Number(row.max_no)
  }

  countAssetsForEpisode(episodeId: string) {
    const row = this.database.connection
      .prepare(`
        SELECT COUNT(*) AS total
        FROM assets asset
        JOIN asset_slots slot ON slot.id = asset.asset_slot_id
        WHERE slot.episode_id = ?
      `)
      .get(episodeId) as SqlRow
    return Number(row.total)
  }

  deleteDraftGraphByEpisode(episodeId: string) {
    this.database.connection
      .prepare("DELETE FROM asset_slots WHERE episode_id = ?")
      .run(episodeId)
    this.database.connection.prepare("DELETE FROM scenes WHERE episode_id = ?").run(episodeId)
    this.deleteOrphanImportBatchesByEpisode(episodeId)
  }

  deleteOrphanImportBatchesByEpisode(episodeId: string) {
    this.database.connection
      .prepare(`
        DELETE FROM scene_import_batches
        WHERE episode_id = ?
          AND NOT EXISTS (SELECT 1 FROM scenes WHERE scenes.source_import_batch_id = scene_import_batches.id)
      `)
      .run(episodeId)
  }
}
