import type {
  ArchiveEpisodeCommand,
  AssetFileIntegrity,
  CreateEpisodeCommand,
  Episode,
  EpisodeAggregate,
  EpisodeListQuery,
  EpisodeSummary,
  Page,
  UpdateEpisodeCommand,
} from "../../shared/domain"
import { DomainError, NotFoundError } from "../domain/errors"
import { newId, normalizeKey, nowUtc, slugify } from "../domain/helpers"
import type { StudioDatabase } from "../persistence/database"
import { EpisodeRepository } from "../persistence/repositories/episode-repository"
import { SceneRepository } from "../persistence/repositories/scene-repository"
import { rethrowSqliteConstraint } from "../persistence/sqlite-errors"

export class EpisodeService {
  constructor(
    private readonly database: StudioDatabase,
    private readonly episodes: EpisodeRepository,
    private readonly scenes: SceneRepository,
    private readonly assetIntegrity: (assetId: string) => AssetFileIntegrity,
  ) {}

  list(query: EpisodeListQuery): Page<EpisodeSummary> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 25
    let items = this.episodes.listRecords(query).map((episode) => this.summary(episode))
    if (query.workflowStatus) items = items.filter((item) => item.workflowStatus === query.workflowStatus)
    const total = items.length
    return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total }
  }

  get(id: string): EpisodeAggregate {
    const episode = this.episodes.getById(id)
    if (!episode) throw new NotFoundError("Episode")
    return { ...this.summary(episode), scenes: this.scenes.listByEpisode(id) }
  }

  create(command: CreateEpisodeCommand) {
    const now = nowUtc()
    const slug = slugify(command.slug ?? command.title)
    const episode: Episode = {
      id: newId(),
      title: command.title.trim(),
      slug,
      slugKey: normalizeKey(slug),
      topic: command.topic,
      description: command.description.trim(),
      notes: command.notes ?? "",
      thumbnailRelativePath: command.thumbnailRelativePath ?? null,
      revisionNo: 1,
      createdByName: command.createdByName.trim(),
      updatedByName: command.createdByName.trim(),
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }
    try {
      this.episodes.insert(episode)
      return episode
    } catch (error) {
      rethrowSqliteConstraint(error)
    }
  }

  update(command: UpdateEpisodeCommand) {
    const current = this.episodes.getById(command.id)
    if (!current) throw new NotFoundError("Episode")
    if (current.archivedAt) throw new DomainError("INVALID_TRANSITION", "Episode đã archive không thể chỉnh sửa.")
    const slug = command.patch.slug
      ? slugify(command.patch.slug)
      : command.patch.title && !command.patch.slug
        ? current.slug
        : current.slug
    const next: Episode = {
      ...current,
      ...command.patch,
      title: command.patch.title?.trim() ?? current.title,
      slug,
      slugKey: normalizeKey(slug),
      description: command.patch.description?.trim() ?? current.description,
      updatedByName: command.updatedByName.trim(),
      updatedAt: nowUtc(),
    }
    try {
      return this.episodes.update(next, command.expectedRevisionNo)
    } catch (error) {
      rethrowSqliteConstraint(error)
    }
  }

  archive(command: ArchiveEpisodeCommand) {
    if (!this.episodes.getById(command.id)) throw new NotFoundError("Episode")
    return this.episodes.archive(command.id, command.expectedRevisionNo, command.updatedByName.trim(), nowUtc())
  }

  private summary(episode: Episode): EpisodeSummary {
    const facts = this.episodes.workflowFacts(episode.id)
    const allScenesApproved = facts.sceneCount > 0 && facts.approvedSceneCount === facts.sceneCount
    const allRequiredFulfilled =
      facts.requiredSlotCount > 0 && facts.fulfilledRequiredSlotCount === facts.requiredSlotCount
    const allFilesAvailable =
      facts.requiredAcceptedAssetIds.length === facts.requiredSlotCount &&
      facts.requiredAcceptedAssetIds.every((assetId) => this.assetIntegrity(assetId) === "available")
    const workflowStatus = allScenesApproved && allRequiredFulfilled && allFilesAvailable
      ? "ready_to_export"
      : facts.activeAssetCount > 0
        ? "producing"
        : allScenesApproved
          ? "scenes_ready"
          : "draft"

    return {
      ...episode,
      workflowStatus,
      sceneCount: facts.sceneCount,
      productionProgress:
        facts.requiredSlotCount === 0
          ? 0
          : Math.round((facts.fulfilledRequiredSlotCount / facts.requiredSlotCount) * 100),
    }
  }
}
