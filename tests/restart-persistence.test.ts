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
        revisionNo: updatedEpisode.revisionNo,
      })
      expect(foundation.services.episodeThumbnails.read({ relativePath: thumbnail.relativePath })).toEqual(thumbnail)
    } finally {
      foundation?.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
