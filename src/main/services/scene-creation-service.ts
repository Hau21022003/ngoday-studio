import type {
  AssetSlot,
  CommitScenesImportCommand,
  RenderScenePromptCommand,
  Scene,
  SceneImportBatch,
  ScenesImportDocument,
  ScenesImportPreview,
  ScenesImportResult,
  ValidateScenesImportCommand,
} from "../../shared/domain"
import { scenesImportDocumentSchema } from "../../shared/validation"
import { DomainError, NotFoundError, StaleRevisionError } from "../domain/errors"
import { canonicalAssetName, newId, normalizeKey, nowUtc, sha256 } from "../domain/helpers"
import type { StudioDatabase } from "../persistence/database"
import { AssetSlotRepository } from "../persistence/repositories/asset-slot-repository"
import { EpisodeRepository } from "../persistence/repositories/episode-repository"
import { SceneRepository } from "../persistence/repositories/scene-repository"
import { TemplateRepository } from "../persistence/repositories/template-repository"
import { rethrowSqliteConstraint } from "../persistence/sqlite-errors"
import { TemplateService } from "./template-service"

function extractJson(rawJson: string) {
  const trimmed = rawJson.trim()
  const fence = trimmed.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i)
  return { json: fence?.[1] ?? rawJson, strippedFence: Boolean(fence) }
}

function parseDocument(rawJson: string): { document: ScenesImportDocument; strippedFence: boolean } {
  const extracted = extractJson(rawJson)
  let parsed: unknown
  try {
    parsed = JSON.parse(extracted.json)
  } catch (error) {
    throw new DomainError("IMPORT_INVALID", "JSON Scenes không parse được.", { cause: error })
  }
  const result = scenesImportDocumentSchema.safeParse(parsed)
  if (!result.success) {
    const fieldErrors = Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join(".") || "root", issue.message]),
    )
    throw new DomainError("IMPORT_INVALID", "JSON Scenes không đúng schema v1.", { fieldErrors })
  }

  const scenes = [...result.data.scenes]
    .sort((left, right) => left.order - right.order)
    .map((scene) => ({
      ...scene,
      assetSlots: [...scene.assetSlots].sort((left, right) => left.order - right.order),
    }))
  return { document: { schemaVersion: 1, scenes }, strippedFence: extracted.strippedFence }
}

export class SceneCreationService {
  constructor(
    private readonly database: StudioDatabase,
    private readonly templates: TemplateRepository,
    private readonly templateService: TemplateService,
    private readonly episodes: EpisodeRepository,
    private readonly scenes: SceneRepository,
    private readonly slots: AssetSlotRepository,
  ) {}

  renderPrompt(command: RenderScenePromptCommand) {
    const episode = this.episodes.getById(command.episodeId)
    if (!episode) throw new NotFoundError("Episode")
    const version = this.templates.getVersionById(command.templateVersionId)
    if (!version) throw new NotFoundError("TemplateVersion")
    const known = new Set(version.variables.map((variable) => variable.name))
    const standardValues: Record<string, string> = {
      episode_title: episode.title,
      episode_topic: episode.topic,
      episode_description: episode.description,
      source_content: command.sourceContent ?? "",
    }
    const values = { ...(command.values ?? {}) }
    for (const [name, value] of Object.entries(standardValues)) {
      if (known.has(name) && values[name] === undefined) values[name] = value
    }
    return this.templateService.render({ templateVersionId: command.templateVersionId, values })
  }

  validateImport(command: ValidateScenesImportCommand): ScenesImportPreview {
    if (!this.episodes.getById(command.episodeId)) throw new NotFoundError("Episode")
    if (!this.templates.getVersionById(command.templateVersionId)) throw new NotFoundError("TemplateVersion")
    if (command.mode === "replace" && this.scenes.countAssetsForEpisode(command.episodeId) > 0) {
      throw new DomainError(
        "SCENES_REPLACE_CONFLICT",
        "Không thể replace Scenes vì Episode đã từng có Asset.",
      )
    }

    const { document, strippedFence } = parseDocument(command.rawJson)
    const warnings: string[] = []
    if (strippedFence) warnings.push("Đã bóc outer Markdown JSON fence trước khi validate.")
    let defaultSlotCount = 0
    const normalized: ScenesImportDocument = {
      schemaVersion: 1,
      scenes: document.scenes.map((scene) => {
        if (scene.assetSlots.length > 0) return scene
        defaultSlotCount += 1
        return {
          ...scene,
          assetSlots: [
            {
              order: 1,
              mediaType: scene.mediaType,
              prompt: scene.visualDescription,
              required: true,
            },
          ],
        }
      }),
    }
    if (defaultSlotCount > 0) warnings.push(`Đã tạo required AssetSlot mặc định cho ${defaultSlotCount} Scene.`)

    return {
      payloadHash: sha256(command.rawJson),
      document: normalized,
      sceneCount: normalized.scenes.length,
      slotCount: normalized.scenes.reduce((total, scene) => total + scene.assetSlots.length, 0),
      warnings,
    }
  }

  commitImport(command: CommitScenesImportCommand): ScenesImportResult {
    const preview = this.validateImport(command)
    if (preview.payloadHash !== command.payloadHash) {
      throw new DomainError("IMPORT_INVALID", "JSON đã thay đổi sau preview; hãy preview lại trước khi import.")
    }

    const episode = this.episodes.getById(command.episodeId)
    if (!episode) throw new NotFoundError("Episode")
    if (episode.revisionNo !== command.expectedEpisodeRevisionNo) throw new StaleRevisionError("Episode")

    const now = nowUtc()
    const batch: SceneImportBatch = {
      id: newId(),
      episodeId: command.episodeId,
      templateVersionId: command.templateVersionId,
      mode: command.mode,
      payloadHash: command.payloadHash,
      renderedPromptHash: command.renderedPromptHash ?? null,
      sceneCount: preview.sceneCount,
      createdAt: now,
    }

    try {
      return this.database.transaction(() => {
        const current = this.episodes.getById(command.episodeId)
        if (!current || current.revisionNo !== command.expectedEpisodeRevisionNo) {
          throw new StaleRevisionError("Episode")
        }
        if (command.mode === "replace") {
          if (this.scenes.countAssetsForEpisode(command.episodeId) > 0) {
            throw new DomainError("SCENES_REPLACE_CONFLICT", "Không thể replace Scenes vì Episode đã từng có Asset.")
          }
          this.scenes.deleteDraftGraphByEpisode(command.episodeId)
        }

        const displayBase = command.mode === "append" ? this.scenes.listByEpisode(command.episodeId).length : 0
        const canonicalBase = command.mode === "append" ? this.scenes.maxCanonicalNo(command.episodeId) : 0
        const scenes: Scene[] = []
        const slots: AssetSlot[] = []
        for (const [sceneIndex, input] of preview.document.scenes.entries()) {
          const scene: Scene = {
            id: newId(),
            episodeId: command.episodeId,
            displayOrder: displayBase + sceneIndex + 1,
            canonicalNo: canonicalBase + sceneIndex + 1,
            title: input.title.trim(),
            summary: input.summary,
            narration: input.narration,
            visualDescription: input.visualDescription,
            sceneType: input.sceneType,
            defaultMediaType: input.mediaType,
            notes: input.notes,
            status: "draft",
            sourceImportBatchId: batch.id,
            revisionNo: 1,
            approvedAt: null,
            createdAt: now,
            updatedAt: now,
          }
          scenes.push(scene)
          for (const inputSlot of input.assetSlots) {
            const canonicalName = canonicalAssetName(scene.canonicalNo, inputSlot.order)
            slots.push({
              id: newId(),
              episodeId: command.episodeId,
              sceneId: scene.id,
              slotOrder: inputSlot.order,
              canonicalName,
              canonicalNameKey: normalizeKey(canonicalName),
              mediaType: inputSlot.mediaType,
              prompt: inputSlot.prompt,
              required: inputSlot.required,
              status: "draft",
              revisionNo: 1,
              createdAt: now,
              updatedAt: now,
            })
          }
        }

        this.scenes.insertImportBatch(batch)
        this.scenes.insertMany(scenes)
        this.slots.insertMany(slots)
        const updatedEpisode = this.episodes.bumpRevision(command.episodeId, command.expectedEpisodeRevisionNo, now)
        return { importBatchId: batch.id, episodeRevisionNo: updatedEpisode.revisionNo, scenes, assetSlots: slots }
      })
    } catch (error) {
      rethrowSqliteConstraint(error)
    }
  }
}
