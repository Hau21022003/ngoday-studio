import type { MetadataBackupPayload } from "../../../shared/domain"
import {
  mapAsset,
  mapAssetSlot,
  mapEpisode,
  mapScene,
  mapSceneImportBatch,
  mapTemplate,
  mapTemplateVersion,
  type SqlRow,
} from "../row-mappers"
import type { StudioDatabase } from "../database"

const businessTables = [
  "prompt_templates",
  "prompt_template_versions",
  "episodes",
  "scene_import_batches",
  "scenes",
  "asset_slots",
  "assets",
] as const

export class MetadataBackupRepository {
  constructor(private readonly database: StudioDatabase) {}

  readPayload(): MetadataBackupPayload {
    const rows = (table: string, order: string) => this.database.connection
      .prepare(`SELECT * FROM ${table} ORDER BY ${order}`)
      .all() as SqlRow[]
    return {
      templates: rows("prompt_templates", "created_at, id").map(mapTemplate),
      templateVersions: rows("prompt_template_versions", "created_at, id").map(mapTemplateVersion),
      episodes: rows("episodes", "created_at, id").map(mapEpisode),
      sceneImportBatches: rows("scene_import_batches", "created_at, id").map(mapSceneImportBatch),
      scenes: rows("scenes", "episode_id, canonical_no").map(mapScene),
      assetSlots: rows("asset_slots", "episode_id, scene_id, slot_order").map(mapAssetSlot),
      assets: rows("assets", "created_at, id").map(mapAsset),
    }
  }

  businessRowCount() {
    return businessTables.reduce((total, table) => {
      const row = this.database.connection.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as SqlRow
      return total + Number(row.total)
    }, 0)
  }
}
