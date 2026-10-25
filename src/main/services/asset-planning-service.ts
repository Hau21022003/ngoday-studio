import type { AssetSlot, CreateAssetSlotCommand, UpdateAssetSlotCommand } from "../../shared/domain"
import { DomainError, NotFoundError, StaleRevisionError } from "../domain/errors"
import { canonicalAssetName, newId, normalizeKey, nowUtc } from "../domain/helpers"
import type { StudioDatabase } from "../persistence/database"
import { AssetRepository } from "../persistence/repositories/asset-repository"
import { AssetSlotRepository } from "../persistence/repositories/asset-slot-repository"
import { SceneRepository } from "../persistence/repositories/scene-repository"
import { rethrowSqliteConstraint } from "../persistence/sqlite-errors"

export class AssetPlanningService {
  constructor(
    private readonly database: StudioDatabase,
    private readonly scenes: SceneRepository,
    private readonly slots: AssetSlotRepository,
    private readonly assets: AssetRepository,
  ) {}

  list(episodeId: string) {
    return this.slots.listByEpisode(episodeId)
  }

  create(command: CreateAssetSlotCommand) {
    const scene = this.scenes.getById(command.sceneId)
    if (!scene || scene.episodeId !== command.episodeId) throw new NotFoundError("Scene")
    if (scene.revisionNo !== command.expectedSceneRevisionNo) throw new StaleRevisionError("Scene")
    const slotOrder = this.slots.nextSlotOrder(scene.id)
    const canonicalName = canonicalAssetName(scene.canonicalNo, slotOrder)
    const canonicalNameKey = normalizeKey(canonicalName)
    if (this.slots.countByCanonicalNameKey(scene.episodeId, canonicalNameKey) > 0) {
      throw new DomainError("DUPLICATE_NAME", `Canonical AssetSlot ${canonicalName} đã tồn tại trong Episode.`)
    }
    const now = nowUtc()
    const slot: AssetSlot = {
      id: newId(),
      episodeId: scene.episodeId,
      sceneId: scene.id,
      slotOrder,
      canonicalName,
      canonicalNameKey,
      mediaType: command.mediaType,
      prompt: command.prompt,
      required: command.required,
      status: scene.status === "approved" && command.prompt.trim() ? "ready" : "draft",
      revisionNo: 1,
      createdAt: now,
      updatedAt: now,
    }
    try {
      return this.database.transaction(() => {
        const current = this.scenes.getById(scene.id)
        if (!current || current.revisionNo !== command.expectedSceneRevisionNo) throw new StaleRevisionError("Scene")
        this.slots.insert(slot)
        this.scenes.bumpRevision(scene.id, command.expectedSceneRevisionNo, now)
        return slot
      })
    } catch (error) {
      rethrowSqliteConstraint(error)
    }
  }

  update(command: UpdateAssetSlotCommand) {
    const current = this.slots.getById(command.id)
    if (!current) throw new NotFoundError("AssetSlot")
    const scene = this.scenes.getById(current.sceneId)
    if (!scene) throw new NotFoundError("Scene")
    if (command.patch.mediaType && command.patch.mediaType !== current.mediaType && this.assets.hasActiveForSlot(current.id)) {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Không thể đổi loại media khi AssetSlot còn candidate đang hoạt động. Hãy lưu trữ các candidate trước.",
      )
    }
    const prompt = command.patch.prompt ?? current.prompt
    const status = scene.status !== "approved" || !prompt.trim()
      ? "draft"
      : this.assets.hasAcceptedForSlot(current.id)
        ? "fulfilled"
        : "ready"
    const next: AssetSlot = {
      ...current,
      ...command.patch,
      prompt,
      status,
      updatedAt: nowUtc(),
    }
    return this.slots.update(next, command.expectedRevisionNo)
  }
}
