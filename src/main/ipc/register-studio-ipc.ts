import { z, ZodError, type ZodType } from "zod"

import { studioChannels } from "../../shared/ipc"
import {
  archiveEpisodeCommandSchema,
  assetListQuerySchema,
  assetProjectionSchema,
  assetSlotSchema,
  assetTransitionCommandSchema,
  commitScenesImportCommandSchema,
  createAssetSlotCommandSchema,
  createEpisodeCommandSchema,
  createTemplateCommandSchema,
  createTemplateVersionCommandSchema,
  episodeAggregateSchema,
  episodeIdCommandSchema,
  episodeThumbnailContentSchema,
  episodeSchema,
  episodeSummarySchema,
  idCommandSchema,
  importEpisodeThumbnailCommandSchema,
  pageSchema,
  importAssetFileCommandSchema,
  importAssetFileResultSchema,
  metadataBackupResultSchema,
  renderedPromptSchema,
  readEpisodeThumbnailCommandSchema,
  renderScenePromptCommandSchema,
  renderTemplateCommandSchema,
  reorderScenesCommandSchema,
  sceneDetailSchema,
  scenesImportPreviewSchema,
  scenesImportResultSchema,
  sceneSchema,
  saveTemplateEditCommandSchema,
  templateAggregateSchema,
  templateListQuerySchema,
  templateSchema,
  templateSummarySchema,
  templateVersionSchema,
  transitionSceneStatusCommandSchema,
  updateAssetSlotCommandSchema,
  updateEpisodeCommandSchema,
  updateSceneCommandSchema,
  updateTemplateCommandSchema,
  validateScenesImportCommandSchema,
  episodeListQuerySchema,
} from "../../shared/validation"
import type { IpcResult } from "../../shared/domain"
import { DomainError } from "../domain/errors"
import type { PersistenceFoundation } from "../persistence/foundation"

export type IpcRegistrar = {
  handle(channel: string, listener: (event: unknown, input: unknown) => unknown): void
}

export type StudioPlatformActions = {
  chooseAssetFile(event: unknown): Promise<string | null>
  chooseMetadataBackupDestination(event: unknown): Promise<string | null>
  chooseMetadataBackupSource(event: unknown): Promise<string | null>
  openFile(path: string): Promise<void>
  revealFile(path: string): void
}

function fieldErrors(error: ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [issue.path.join(".") || "root", issue.message]))
}

export function toIpcError(error: unknown): IpcResult<never> {
  if (error instanceof DomainError) return { ok: false, error: error.toPayload() }
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Payload IPC không hợp lệ.",
        fieldErrors: fieldErrors(error),
        retryable: false,
      },
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/SQLITE_BUSY|database is locked/i.test(message)) {
    return { ok: false, error: { code: "DB_UNAVAILABLE", message: "Database đang bận.", retryable: true } }
  }
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "Lỗi nội bộ không mong đợi.", retryable: false } }
}

export function registerValidatedHandler<I, O>(
  registrar: IpcRegistrar,
  channel: string,
  inputSchema: ZodType<I>,
  outputSchema: ZodType<O>,
  handler: (input: I, event: unknown) => O | Promise<O>,
) {
  registrar.handle(channel, async (event, rawInput) => {
    let input: I
    try {
      input = inputSchema.parse(rawInput)
    } catch (error) {
      return toIpcError(error)
    }
    try {
      const output = await handler(input, event)
      const parsedOutput = outputSchema.safeParse(output)
      if (!parsedOutput.success) {
        return {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Response nội bộ không đúng contract.",
            retryable: false,
          },
        } satisfies IpcResult<never>
      }
      return { ok: true, data: parsedOutput.data } satisfies IpcResult<O>
    } catch (error) {
      return toIpcError(error)
    }
  })
}

export function registerStudioIpc(
  registrar: IpcRegistrar,
  foundation: PersistenceFoundation,
  platformActions?: StudioPlatformActions,
) {
  const { services } = foundation
  registerValidatedHandler(registrar, studioChannels.templatesList, templateListQuerySchema, pageSchema(templateSummarySchema), (input) => services.templates.list(input))
  registerValidatedHandler(registrar, studioChannels.templatesGet, idCommandSchema, templateAggregateSchema, ({ id }) => services.templates.get(id))
  registerValidatedHandler(registrar, studioChannels.templatesCreate, createTemplateCommandSchema, templateAggregateSchema, (input) => services.templates.create(input))
  registerValidatedHandler(registrar, studioChannels.templatesUpdateMetadata, updateTemplateCommandSchema, templateSchema, (input) => services.templates.updateMetadata(input))
  registerValidatedHandler(registrar, studioChannels.templatesCreateVersion, createTemplateVersionCommandSchema, templateVersionSchema, (input) => services.templates.createVersion(input))
  registerValidatedHandler(registrar, studioChannels.templatesSaveEdit, saveTemplateEditCommandSchema, templateAggregateSchema, (input) => services.templates.saveEdit(input))
  registerValidatedHandler(registrar, studioChannels.templatesRender, renderTemplateCommandSchema, renderedPromptSchema, (input) => services.templates.render(input))

  registerValidatedHandler(registrar, studioChannels.episodesList, episodeListQuerySchema, pageSchema(episodeSummarySchema), (input) => services.episodes.list(input))
  registerValidatedHandler(registrar, studioChannels.episodesGet, idCommandSchema, episodeAggregateSchema, ({ id }) => services.episodes.get(id))
  registerValidatedHandler(registrar, studioChannels.episodesCreate, createEpisodeCommandSchema, episodeSchema, (input) => services.episodes.create(input))
  registerValidatedHandler(registrar, studioChannels.episodesUpdate, updateEpisodeCommandSchema, episodeSchema, (input) => services.episodes.update(input))
  registerValidatedHandler(registrar, studioChannels.episodesArchive, archiveEpisodeCommandSchema, episodeSchema, (input) => services.episodes.archive(input))

  registerValidatedHandler(registrar, studioChannels.episodeThumbnailsImport, importEpisodeThumbnailCommandSchema, episodeThumbnailContentSchema, (input) => services.episodeThumbnails.import(input))
  registerValidatedHandler(registrar, studioChannels.episodeThumbnailsRead, readEpisodeThumbnailCommandSchema, episodeThumbnailContentSchema, (input) => services.episodeThumbnails.read(input))

  registerValidatedHandler(registrar, studioChannels.sceneCreationRenderPrompt, renderScenePromptCommandSchema, renderedPromptSchema, (input) => services.sceneCreation.renderPrompt(input))
  registerValidatedHandler(registrar, studioChannels.sceneCreationValidateImport, validateScenesImportCommandSchema, scenesImportPreviewSchema, (input) => services.sceneCreation.validateImport(input))
  registerValidatedHandler(registrar, studioChannels.sceneCreationCommitImport, commitScenesImportCommandSchema, scenesImportResultSchema, (input) => services.sceneCreation.commitImport(input))

  registerValidatedHandler(registrar, studioChannels.scenesList, episodeIdCommandSchema, z.array(sceneSchema), ({ episodeId }) => services.scenes.list(episodeId))
  registerValidatedHandler(registrar, studioChannels.scenesGet, idCommandSchema, sceneDetailSchema, ({ id }) => services.scenes.get(id))
  registerValidatedHandler(registrar, studioChannels.scenesUpdate, updateSceneCommandSchema, sceneSchema, (input) => services.scenes.update(input))
  registerValidatedHandler(registrar, studioChannels.scenesReorder, reorderScenesCommandSchema, z.array(sceneSchema), (input) => services.scenes.reorder(input))
  registerValidatedHandler(registrar, studioChannels.scenesTransitionStatus, transitionSceneStatusCommandSchema, sceneSchema, (input) => services.scenes.transitionStatus(input))

  registerValidatedHandler(registrar, studioChannels.assetSlotsList, episodeIdCommandSchema, z.array(assetSlotSchema), ({ episodeId }) => services.assetSlots.list(episodeId))
  registerValidatedHandler(registrar, studioChannels.assetSlotsCreate, createAssetSlotCommandSchema, assetSlotSchema, (input) => services.assetSlots.create(input))
  registerValidatedHandler(registrar, studioChannels.assetSlotsUpdate, updateAssetSlotCommandSchema, assetSlotSchema, (input) => services.assetSlots.update(input))

  registerValidatedHandler(registrar, studioChannels.assetsList, assetListQuerySchema, pageSchema(assetProjectionSchema), (input) => services.assets.list(input))
  registerValidatedHandler(registrar, studioChannels.assetsGet, idCommandSchema, assetProjectionSchema, ({ id }) => services.assets.get(id))
  registerValidatedHandler(registrar, studioChannels.assetsImportFile, importAssetFileCommandSchema, importAssetFileResultSchema, async (input, event) => {
    if (!platformActions) throw new DomainError("INTERNAL_ERROR", "Native file picker chưa được cấu hình.")
    const sourcePath = await platformActions.chooseAssetFile(event)
    if (!sourcePath) return { cancelled: true, asset: null }
    return { cancelled: false, asset: await services.assets.importFile(input, sourcePath) }
  })
  registerValidatedHandler(registrar, studioChannels.assetsVerifyIntegrity, idCommandSchema, assetProjectionSchema, ({ id }) => services.assets.verifyIntegrity(id))
  registerValidatedHandler(registrar, studioChannels.assetsOpenFile, idCommandSchema, idCommandSchema, async ({ id }) => {
    if (!platformActions) throw new DomainError("INTERNAL_ERROR", "Native shell action chưa được cấu hình.")
    await platformActions.openFile(services.assets.registeredFilePath(id))
    return { id }
  })
  registerValidatedHandler(registrar, studioChannels.assetsRevealFile, idCommandSchema, idCommandSchema, ({ id }) => {
    if (!platformActions) throw new DomainError("INTERNAL_ERROR", "Native shell action chưa được cấu hình.")
    platformActions.revealFile(services.assets.registeredFilePath(id))
    return { id }
  })
  registerValidatedHandler(registrar, studioChannels.assetsAccept, assetTransitionCommandSchema, assetProjectionSchema, (input) => services.assets.accept(input))
  registerValidatedHandler(registrar, studioChannels.assetsReject, assetTransitionCommandSchema, assetProjectionSchema, (input) => services.assets.reject(input))
  registerValidatedHandler(registrar, studioChannels.assetsArchive, assetTransitionCommandSchema, idCommandSchema, (input) => services.assets.archive(input))

  const emptyInput = z.object({}).strict()
  registerValidatedHandler(registrar, studioChannels.metadataBackupExport, emptyInput, metadataBackupResultSchema, async (_input, event) => {
    if (!platformActions) throw new DomainError("INTERNAL_ERROR", "Native backup dialog chưa được cấu hình.")
    const destination = await platformActions.chooseMetadataBackupDestination(event)
    if (!destination) return { cancelled: true, fileName: null, summary: null }
    return { cancelled: false, ...services.metadataBackup.exportTo(destination) }
  })
  registerValidatedHandler(registrar, studioChannels.metadataBackupRestore, emptyInput, metadataBackupResultSchema, async (_input, event) => {
    if (!platformActions) throw new DomainError("INTERNAL_ERROR", "Native restore dialog chưa được cấu hình.")
    const source = await platformActions.chooseMetadataBackupSource(event)
    if (!source) return { cancelled: true, fileName: null, summary: null }
    return { cancelled: false, ...services.metadataBackup.restoreFrom(source) }
  })
}
