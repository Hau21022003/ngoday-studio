import { join } from "node:path"

import { AssetRepository } from "./repositories/asset-repository"
import { AssetSlotRepository } from "./repositories/asset-slot-repository"
import { EpisodeRepository } from "./repositories/episode-repository"
import { SceneRepository } from "./repositories/scene-repository"
import { TemplateRepository } from "./repositories/template-repository"
import { AssetPlanningService } from "../services/asset-planning-service"
import { AssetService } from "../services/asset-service"
import { EpisodeService } from "../services/episode-service"
import { EpisodeThumbnailService } from "../services/episode-thumbnail-service"
import { SceneCreationService } from "../services/scene-creation-service"
import { SceneService } from "../services/scene-service"
import { TemplateService } from "../services/template-service"
import { StudioDatabase } from "./database"
import { migrations } from "./migration-catalog"
import { runMigrations, type MigrationRunResult } from "./migration-runner"

export type PersistenceFoundation = {
  database: StudioDatabase
  migration: MigrationRunResult
  services: {
    templates: TemplateService
    episodes: EpisodeService
    episodeThumbnails: EpisodeThumbnailService
    sceneCreation: SceneCreationService
    scenes: SceneService
    assetSlots: AssetPlanningService
    assets: AssetService
  }
  close(): void
}

export async function initializePersistence(options: {
  databasePath: string
  backupDirectory: string
  workspaceRoot: string
  appVersion: string
}): Promise<PersistenceFoundation> {
  const database = new StudioDatabase(options.databasePath)
  try {
    const migration = await runMigrations({
      database,
      catalog: migrations,
      appVersion: options.appVersion,
      backupDirectory: options.backupDirectory,
    })
    const templates = new TemplateRepository(database)
    const episodes = new EpisodeRepository(database)
    const scenes = new SceneRepository(database)
    const slots = new AssetSlotRepository(database)
    const assets = new AssetRepository(database)
    const templateService = new TemplateService(database, templates)
    const assetService = new AssetService(database, options.workspaceRoot, scenes, slots, assets)
    const episodeThumbnailService = new EpisodeThumbnailService(options.workspaceRoot)

    return {
      database,
      migration,
      services: {
        templates: templateService,
        episodes: new EpisodeService(database, episodes, scenes, (assetId) => assetService.fileIntegrity(assetId)),
        episodeThumbnails: episodeThumbnailService,
        sceneCreation: new SceneCreationService(
          database,
          templates,
          templateService,
          episodes,
          scenes,
          slots,
        ),
        scenes: new SceneService(database, episodes, scenes, slots, assets),
        assetSlots: new AssetPlanningService(database, scenes, slots, assets),
        assets: assetService,
      },
      close: () => database.close(),
    }
  } catch (error) {
    database.close()
    throw error
  }
}

export function defaultPersistencePaths(userDataDirectory: string) {
  return {
    databasePath: join(userDataDirectory, "data", "ngoday-studio.sqlite3"),
    backupDirectory: join(userDataDirectory, "backups"),
    workspaceRoot: join(userDataDirectory, "workspace"),
  }
}
