import type { AssetSlot } from "../../../shared/domain"
import { StaleRevisionError } from "../../domain/errors"
import type { StudioDatabase } from "../database"
import { mapAssetSlot, type SqlRow } from "../row-mappers"

export class AssetSlotRepository {
  constructor(private readonly database: StudioDatabase) {}

  listByEpisode(episodeId: string) {
    const rows = this.database.connection
      .prepare("SELECT * FROM asset_slots WHERE episode_id = ? ORDER BY scene_id, slot_order")
      .all(episodeId) as SqlRow[]
    return rows.map(mapAssetSlot)
  }

  listByScene(sceneId: string) {
    const rows = this.database.connection
      .prepare("SELECT * FROM asset_slots WHERE scene_id = ? ORDER BY slot_order")
      .all(sceneId) as SqlRow[]
    return rows.map(mapAssetSlot)
  }

  getById(id: string): AssetSlot | null {
    const row = this.database.connection.prepare("SELECT * FROM asset_slots WHERE id = ?").get(id) as SqlRow | undefined
    return row ? mapAssetSlot(row) : null
  }

  insert(slot: AssetSlot) {
    this.insertMany([slot])
  }

  insertMany(slots: AssetSlot[]) {
    const statement = this.database.connection.prepare(`
      INSERT INTO asset_slots (
        id, episode_id, scene_id, slot_order, canonical_name, canonical_name_key,
        media_type, prompt, required, status, revision_no, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const slot of slots) {
      statement.run(
        slot.id,
        slot.episodeId,
        slot.sceneId,
        slot.slotOrder,
        slot.canonicalName,
        slot.canonicalNameKey,
        slot.mediaType,
        slot.prompt,
        slot.required ? 1 : 0,
        slot.status,
        slot.revisionNo,
        slot.createdAt,
        slot.updatedAt,
      )
    }
  }

  update(slot: AssetSlot, expectedRevisionNo: number) {
    const result = this.database.connection
      .prepare(`
        UPDATE asset_slots
        SET media_type = ?, prompt = ?, required = ?, status = ?,
            updated_at = ?, revision_no = revision_no + 1
        WHERE id = ? AND revision_no = ?
      `)
      .run(
        slot.mediaType,
        slot.prompt,
        slot.required ? 1 : 0,
        slot.status,
        slot.updatedAt,
        slot.id,
        expectedRevisionNo,
      )
    if (Number(result.changes) !== 1) throw new StaleRevisionError("AssetSlot")
    return this.getById(slot.id)!
  }

  setStatus(id: string, status: AssetSlot["status"], expectedRevisionNo: number, at: string) {
    const result = this.database.connection
      .prepare(`
        UPDATE asset_slots
        SET status = ?, updated_at = ?, revision_no = revision_no + 1
        WHERE id = ? AND revision_no = ?
      `)
      .run(status, at, id, expectedRevisionNo)
    if (Number(result.changes) !== 1) throw new StaleRevisionError("AssetSlot")
    return this.getById(id)!
  }

  nextSlotOrder(sceneId: string) {
    const row = this.database.connection
      .prepare("SELECT COALESCE(MAX(slot_order), 0) AS max_order FROM asset_slots WHERE scene_id = ?")
      .get(sceneId) as SqlRow
    return Number(row.max_order) + 1
  }
}
