import type {
  ReorderScenesCommand,
  Scene,
  SceneDetail,
  TransitionSceneStatusCommand,
  UpdateSceneCommand,
} from "../../shared/domain"
import { DomainError, NotFoundError, StaleRevisionError } from "../domain/errors"
import { nowUtc } from "../domain/helpers"
import type { StudioDatabase } from "../persistence/database"
import { AssetRepository } from "../persistence/repositories/asset-repository"
import { AssetSlotRepository } from "../persistence/repositories/asset-slot-repository"
import { EpisodeRepository } from "../persistence/repositories/episode-repository"
import { SceneRepository } from "../persistence/repositories/scene-repository"

const contentFields = new Set([
  "title",
  "summary",
  "narration",
  "visualDescription",
  "sceneType",
  "defaultMediaType",
])

export class SceneService {
  constructor(
    private readonly database: StudioDatabase,
    private readonly episodes: EpisodeRepository,
    private readonly scenes: SceneRepository,
    private readonly slots: AssetSlotRepository,
    private readonly assets: AssetRepository,
  ) {}

  list(episodeId: string) {
    if (!this.episodes.getById(episodeId)) throw new NotFoundError("Episode")
    return this.scenes.listByEpisode(episodeId)
  }

  get(id: string): SceneDetail {
    const scene = this.scenes.getById(id)
    if (!scene) throw new NotFoundError("Scene")
    return {
      ...scene,
      assetSlots: this.slots.listByScene(id),
      provenance: scene.sourceImportBatchId
        ? this.scenes.getImportBatchById(scene.sourceImportBatchId)
        : null,
    }
  }

  update(command: UpdateSceneCommand) {
    const current = this.scenes.getById(command.id)
    if (!current) throw new NotFoundError("Scene")
    const contentChanged = Object.keys(command.patch).some((key) => contentFields.has(key))
    const next: Scene = {
      ...current,
      ...command.patch,
      title: command.patch.title?.trim() ?? current.title,
      status: current.status === "approved" && contentChanged ? "draft" : current.status,
      approvedAt: current.status === "approved" && contentChanged ? null : current.approvedAt,
      updatedAt: nowUtc(),
    }
    return this.database.transaction(() => {
      const updated = this.scenes.update(next, command.expectedRevisionNo)
      this.syncSlotStatuses(updated)
      return updated
    })
  }

  transitionStatus(command: TransitionSceneStatusCommand) {
    const current = this.scenes.getById(command.id)
    if (!current) throw new NotFoundError("Scene")
    if (current.revisionNo !== command.expectedRevisionNo) throw new StaleRevisionError("Scene")
    if (command.status === "approved") this.assertApprovable(current)
    const now = nowUtc()
    const next: Scene = {
      ...current,
      status: command.status,
      approvedAt: command.status === "approved" ? now : null,
      updatedAt: now,
    }
    return this.database.transaction(() => {
      const updated = this.scenes.update(next, command.expectedRevisionNo)
      this.syncSlotStatuses(updated)
      return updated
    })
  }

  reorder(command: ReorderScenesCommand) {
    const episode = this.episodes.getById(command.episodeId)
    if (!episode) throw new NotFoundError("Episode")
    if (episode.revisionNo !== command.expectedEpisodeRevisionNo) throw new StaleRevisionError("Episode")
    return this.database.transaction(() => {
      const current = this.episodes.getById(command.episodeId)
      if (!current || current.revisionNo !== command.expectedEpisodeRevisionNo) throw new StaleRevisionError("Episode")
      const scenes = this.scenes.replaceDisplayOrder(command.episodeId, command.orderedSceneIds)
      this.episodes.bumpRevision(command.episodeId, command.expectedEpisodeRevisionNo, nowUtc())
      return scenes
    })
  }

  private assertApprovable(scene: Scene) {
    const fieldErrors: Record<string, string> = {}
    if (!scene.title.trim()) fieldErrors.title = "Bắt buộc."
    if (!scene.narration.trim()) fieldErrors.narration = "Bắt buộc trước khi duyệt."
    if (!scene.visualDescription.trim()) fieldErrors.visualDescription = "Bắt buộc trước khi duyệt."
    if (Object.keys(fieldErrors).length > 0) {
      throw new DomainError("INVALID_TRANSITION", "Scene chưa đủ điều kiện approved.", { fieldErrors })
    }
  }

  private syncSlotStatuses(scene: Scene) {
    for (const slot of this.slots.listByScene(scene.id)) {
      const status = scene.status !== "approved" || !slot.prompt.trim()
        ? "draft"
        : this.assets.hasAcceptedForSlot(slot.id)
          ? "fulfilled"
          : "ready"
      if (status !== slot.status) this.slots.setStatus(slot.id, status, slot.revisionNo, nowUtc())
    }
  }
}
