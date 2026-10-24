import type { Episode, EpisodeListQuery } from "../../../shared/domain"
import { StaleRevisionError } from "../../domain/errors"
import type { StudioDatabase } from "../database"
import { mapEpisode, type SqlRow } from "../row-mappers"

export type EpisodeWorkflowFacts = {
  sceneCount: number
  approvedSceneCount: number
  activeAssetCount: number
  requiredSlotCount: number
  fulfilledRequiredSlotCount: number
  requiredAcceptedAssetIds: string[]
}

export class EpisodeRepository {
  constructor(private readonly database: StudioDatabase) {}

  listRecords(query: EpisodeListQuery): Episode[] {
    const conditions: string[] = []
    const values: string[] = []
    if (!query.includeArchived) conditions.push("archived_at IS NULL")
    if (query.search?.trim()) {
      conditions.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')")
      const escaped = query.search.trim().replace(/[\\%_]/g, "\\$&")
      values.push(`%${escaped}%`, `%${escaped}%`)
    }
    if (query.topic) {
      conditions.push("topic = ?")
      values.push(query.topic)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const rows = this.database.connection
      .prepare(`SELECT * FROM episodes ${where} ORDER BY updated_at DESC`)
      .all(...values) as SqlRow[]
    return rows.map(mapEpisode)
  }

  getById(id: string): Episode | null {
    const row = this.database.connection.prepare("SELECT * FROM episodes WHERE id = ?").get(id) as SqlRow | undefined
    return row ? mapEpisode(row) : null
  }

  insert(episode: Episode) {
    this.database.connection
      .prepare(`
        INSERT INTO episodes (
          id, title, slug, slug_key, topic, description, notes, thumbnail_relative_path,
          revision_no, created_by_name, updated_by_name, created_at, updated_at, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        episode.id,
        episode.title,
        episode.slug,
        episode.slugKey,
        episode.topic,
        episode.description,
        episode.notes,
        episode.thumbnailRelativePath,
        episode.revisionNo,
        episode.createdByName,
        episode.updatedByName,
        episode.createdAt,
        episode.updatedAt,
        episode.archivedAt,
      )
  }

  update(episode: Episode, expectedRevisionNo: number) {
    const result = this.database.connection
      .prepare(`
        UPDATE episodes
        SET title = ?, slug = ?, slug_key = ?, topic = ?, description = ?, notes = ?,
            thumbnail_relative_path = ?, updated_by_name = ?, updated_at = ?,
            revision_no = revision_no + 1
        WHERE id = ? AND revision_no = ?
      `)
      .run(
        episode.title,
        episode.slug,
        episode.slugKey,
        episode.topic,
        episode.description,
        episode.notes,
        episode.thumbnailRelativePath,
        episode.updatedByName,
        episode.updatedAt,
        episode.id,
        expectedRevisionNo,
      )
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Episode")
    return this.getById(episode.id)!
  }

  archive(id: string, expectedRevisionNo: number, updatedByName: string, at: string) {
    const result = this.database.connection
      .prepare(`
        UPDATE episodes
        SET archived_at = ?, updated_by_name = ?, updated_at = ?, revision_no = revision_no + 1
        WHERE id = ? AND revision_no = ? AND archived_at IS NULL
      `)
      .run(at, updatedByName, at, id, expectedRevisionNo)
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Episode")
    return this.getById(id)!
  }

  bumpRevision(id: string, expectedRevisionNo: number, at: string) {
    const result = this.database.connection
      .prepare("UPDATE episodes SET revision_no = revision_no + 1, updated_at = ? WHERE id = ? AND revision_no = ?")
      .run(at, id, expectedRevisionNo)
    if (Number(result.changes) !== 1) throw new StaleRevisionError("Episode")
    return this.getById(id)!
  }

  workflowFacts(episodeId: string): EpisodeWorkflowFacts {
    const row = this.database.connection
      .prepare(`
        SELECT
          (SELECT COUNT(*) FROM scenes WHERE episode_id = ?) AS scene_count,
          (SELECT COUNT(*) FROM scenes WHERE episode_id = ? AND status = 'approved') AS approved_scene_count,
          (SELECT COUNT(*) FROM assets asset
            JOIN asset_slots slot ON slot.id = asset.asset_slot_id
            WHERE slot.episode_id = ? AND asset.archived_at IS NULL) AS active_asset_count,
          (SELECT COUNT(*) FROM asset_slots WHERE episode_id = ? AND required = 1) AS required_slot_count,
          (SELECT COUNT(*) FROM asset_slots WHERE episode_id = ? AND required = 1 AND status = 'fulfilled') AS fulfilled_required_slot_count
      `)
      .get(episodeId, episodeId, episodeId, episodeId, episodeId) as SqlRow
    const assetRows = this.database.connection
      .prepare(`
        SELECT asset.id
        FROM asset_slots slot
        LEFT JOIN assets asset
          ON asset.asset_slot_id = slot.id AND asset.status = 'accepted' AND asset.archived_at IS NULL
        WHERE slot.episode_id = ? AND slot.required = 1
      `)
      .all(episodeId) as SqlRow[]

    return {
      sceneCount: Number(row.scene_count),
      approvedSceneCount: Number(row.approved_scene_count),
      activeAssetCount: Number(row.active_asset_count),
      requiredSlotCount: Number(row.required_slot_count),
      fulfilledRequiredSlotCount: Number(row.fulfilled_required_slot_count),
      requiredAcceptedAssetIds: assetRows.flatMap((assetRow) =>
        typeof assetRow.id === "string" ? [assetRow.id] : [],
      ),
    }
  }
}
