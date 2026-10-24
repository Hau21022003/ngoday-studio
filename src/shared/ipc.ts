import type {
  ArchiveEpisodeCommand,
  AssetListQuery,
  AssetProjection,
  AssetSlot,
  AssetTransitionCommand,
  CommitScenesImportCommand,
  CreateAssetSlotCommand,
  CreateEpisodeCommand,
  CreateTemplateCommand,
  CreateTemplateVersionCommand,
  Episode,
  EpisodeAggregate,
  EpisodeListQuery,
  EpisodeSummary,
  IpcResult,
  Page,
  RegisterImportedAssetCommand,
  RenderedPrompt,
  RenderScenePromptCommand,
  RenderTemplateCommand,
  ReorderScenesCommand,
  Scene,
  SceneDetail,
  ScenesImportPreview,
  ScenesImportResult,
  Template,
  TemplateAggregate,
  TemplateListQuery,
  TemplateSummary,
  TemplateVersion,
  TransitionSceneStatusCommand,
  UpdateAssetSlotCommand,
  UpdateEpisodeCommand,
  UpdateSceneCommand,
  UpdateTemplateCommand,
  ValidateScenesImportCommand,
} from "./domain"

export const studioChannels = {
  templatesList: "studio:templates:list",
  templatesGet: "studio:templates:get",
  templatesCreate: "studio:templates:create",
  templatesUpdateMetadata: "studio:templates:update-metadata",
  templatesCreateVersion: "studio:templates:create-version",
  templatesRender: "studio:templates:render",
  episodesList: "studio:episodes:list",
  episodesGet: "studio:episodes:get",
  episodesCreate: "studio:episodes:create",
  episodesUpdate: "studio:episodes:update",
  episodesArchive: "studio:episodes:archive",
  sceneCreationRenderPrompt: "studio:scene-creation:render-prompt",
  sceneCreationValidateImport: "studio:scene-creation:validate-import",
  sceneCreationCommitImport: "studio:scene-creation:commit-import",
  scenesList: "studio:scenes:list",
  scenesGet: "studio:scenes:get",
  scenesUpdate: "studio:scenes:update",
  scenesReorder: "studio:scenes:reorder",
  scenesTransitionStatus: "studio:scenes:transition-status",
  assetSlotsList: "studio:asset-slots:list",
  assetSlotsCreate: "studio:asset-slots:create",
  assetSlotsUpdate: "studio:asset-slots:update",
  assetsList: "studio:assets:list",
  assetsGet: "studio:assets:get",
  assetsRegisterImported: "studio:assets:register-imported",
  assetsAccept: "studio:assets:accept",
  assetsReject: "studio:assets:reject",
  assetsArchive: "studio:assets:archive",
} as const

export interface StudioApi {
  templates: {
    list(input: TemplateListQuery): Promise<IpcResult<Page<TemplateSummary>>>
    get(input: { id: string }): Promise<IpcResult<TemplateAggregate>>
    create(input: CreateTemplateCommand): Promise<IpcResult<TemplateAggregate>>
    updateMetadata(input: UpdateTemplateCommand): Promise<IpcResult<Template>>
    createVersion(input: CreateTemplateVersionCommand): Promise<IpcResult<TemplateVersion>>
    render(input: RenderTemplateCommand): Promise<IpcResult<RenderedPrompt>>
  }
  episodes: {
    list(input: EpisodeListQuery): Promise<IpcResult<Page<EpisodeSummary>>>
    get(input: { id: string }): Promise<IpcResult<EpisodeAggregate>>
    create(input: CreateEpisodeCommand): Promise<IpcResult<Episode>>
    update(input: UpdateEpisodeCommand): Promise<IpcResult<Episode>>
    archive(input: ArchiveEpisodeCommand): Promise<IpcResult<Episode>>
  }
  sceneCreation: {
    renderPrompt(input: RenderScenePromptCommand): Promise<IpcResult<RenderedPrompt>>
    validateImport(input: ValidateScenesImportCommand): Promise<IpcResult<ScenesImportPreview>>
    commitImport(input: CommitScenesImportCommand): Promise<IpcResult<ScenesImportResult>>
  }
  scenes: {
    list(input: { episodeId: string }): Promise<IpcResult<Scene[]>>
    get(input: { id: string }): Promise<IpcResult<SceneDetail>>
    update(input: UpdateSceneCommand): Promise<IpcResult<Scene>>
    reorder(input: ReorderScenesCommand): Promise<IpcResult<Scene[]>>
    transitionStatus(input: TransitionSceneStatusCommand): Promise<IpcResult<Scene>>
  }
  assetSlots: {
    list(input: { episodeId: string }): Promise<IpcResult<AssetSlot[]>>
    create(input: CreateAssetSlotCommand): Promise<IpcResult<AssetSlot>>
    update(input: UpdateAssetSlotCommand): Promise<IpcResult<AssetSlot>>
  }
  assets: {
    list(input: AssetListQuery): Promise<IpcResult<Page<AssetProjection>>>
    get(input: { id: string }): Promise<IpcResult<AssetProjection>>
    registerImported(input: RegisterImportedAssetCommand): Promise<IpcResult<AssetProjection>>
    accept(input: AssetTransitionCommand): Promise<IpcResult<AssetProjection>>
    reject(input: AssetTransitionCommand): Promise<IpcResult<AssetProjection>>
    archive(input: AssetTransitionCommand): Promise<IpcResult<{ id: string }>>
  }
}

export interface StudioBridge extends StudioApi {
  environment: {
    platform: string
    versions: { electron: string; chrome: string }
  }
}
