import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { initializePersistence, type PersistenceFoundation } from "../src/main/persistence/foundation"
import { seedEpisode, seedSceneTemplate } from "./helpers/seed"

describe("restart persistence", () => {
  it("reopens the same database and workspace with Template, Episode notes, and thumbnail intact", async () => {
    const root = mkdtempSync(join(tmpdir(), "ngoday-m6-restart-"))
    const workspaceRoot = join(root, "workspace")
    mkdirSync(workspaceRoot, { recursive: true })
    const options = {
      databasePath: join(root, "studio.sqlite3"),
      backupDirectory: join(root, "backups"),
      workspaceRoot,
      appVersion: "test",
    }
    let foundation: PersistenceFoundation | null = null

    try {
      foundation = await initializePersistence(options)
      const template = seedSceneTemplate(foundation)
      const episode = seedEpisode(foundation, "Episode kiểm tra restart")
      const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
      const thumbnail = foundation.services.episodeThumbnails.import({
        fileName: "restart.png",
        mimeType: "image/png",
        dataBase64: png.toString("base64"),
      })
      const updatedEpisode = foundation.services.episodes.update({
        id: episode.id,
        expectedRevisionNo: episode.revisionNo,
        updatedByName: "Test",
        patch: { notes: "Ghi chú phải còn sau khi mở lại.", thumbnailRelativePath: thumbnail.relativePath },
      })
      const rawJson = JSON.stringify({
        schemaVersion: 1,
        scenes: [
          {
            order: 1,
            title: "Scene restart A",
            narration: "Narration A còn nguyên sau restart.",
            visualDescription: "Visual A còn nguyên sau restart.",
            sceneType: "ENVIRONMENT",
            mediaType: "image",
          },
          {
            order: 2,
            title: "Scene restart B",
            narration: "Narration B còn nguyên sau restart.",
            visualDescription: "Visual B còn nguyên sau restart.",
            sceneType: "B_ROLL",
            mediaType: "video",
          },
        ],
      })
      const preview = foundation.services.sceneCreation.validateImport({
        episodeId: episode.id,
        templateVersionId: template.versions[0]!.id,
        mode: "append",
        rawJson,
      })
      const imported = foundation.services.sceneCreation.commitImport({
        episodeId: episode.id,
        templateVersionId: template.versions[0]!.id,
        mode: "append",
        rawJson,
        payloadHash: preview.payloadHash,
        expectedEpisodeRevisionNo: updatedEpisode.revisionNo,
      })
      const edited = foundation.services.scenes.update({
        id: imported.scenes[0]!.id,
        expectedRevisionNo: imported.scenes[0]!.revisionNo,
        patch: { summary: "Summary M7 đã persist" },
      })
      foundation.services.scenes.transitionStatus({ id: edited.id, status: "approved", expectedRevisionNo: edited.revisionNo })
      foundation.services.scenes.transitionStatus({ id: imported.scenes[1]!.id, status: "approved", expectedRevisionNo: 1 })
      foundation.services.scenes.reorder({
        episodeId: episode.id,
        orderedSceneIds: [imported.scenes[1]!.id, imported.scenes[0]!.id],
        expectedEpisodeRevisionNo: imported.episodeRevisionNo,
      })
      foundation.close()
      foundation = null

      foundation = await initializePersistence(options)
      expect(foundation.services.templates.get(template.id)).toMatchObject({
        id: template.id,
        name: template.name,
        revisionNo: template.revisionNo,
      })
      expect(foundation.services.episodes.get(episode.id)).toMatchObject({
        id: episode.id,
        notes: updatedEpisode.notes,
        thumbnailRelativePath: thumbnail.relativePath,
        revisionNo: imported.episodeRevisionNo + 1,
        sceneCount: 2,
        workflowStatus: "scenes_ready",
      })
      expect(foundation.services.scenes.list(episode.id).map((scene) => ({
        id: scene.id,
        displayOrder: scene.displayOrder,
        canonicalNo: scene.canonicalNo,
        status: scene.status,
      }))).toEqual([
        { id: imported.scenes[1]!.id, displayOrder: 1, canonicalNo: 2, status: "approved" },
        { id: imported.scenes[0]!.id, displayOrder: 2, canonicalNo: 1, status: "approved" },
      ])
      expect(foundation.services.scenes.get(imported.scenes[0]!.id)).toMatchObject({
        summary: "Summary M7 đã persist",
        assetSlots: [{ canonicalName: "scene-01-01", prompt: "Visual A còn nguyên sau restart." }],
        provenance: { templateVersionId: template.versions[0]!.id },
      })
      expect(foundation.services.episodeThumbnails.read({ relativePath: thumbnail.relativePath })).toEqual(thumbnail)
    } finally {
      foundation?.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
