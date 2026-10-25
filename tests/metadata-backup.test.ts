import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import type { TempFoundation } from "./helpers/temp-foundation"
import { createTempFoundation } from "./helpers/temp-foundation"
import { sceneJson, seedEpisode, seedSceneTemplate } from "./helpers/seed"

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0])
const contexts: TempFoundation[] = []

async function foundation() {
  const context = await createTempFoundation()
  contexts.push(context)
  return context
}

afterEach(() => {
  while (contexts.length > 0) contexts.pop()!.cleanup()
})

describe("metadata backup v1", () => {
  it("round-trips Phase 1 metadata into an empty business database without binary content", async () => {
    const source = await foundation()
    const template = seedSceneTemplate(source.foundation)
    const episode = seedEpisode(source.foundation, "Episode metadata backup")
    source.foundation.services.sceneCreation.renderPrompt({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      sourceContent: "TRANSIENT_SOURCE_MUST_NOT_BE_BACKED_UP",
    })
    const rawJson = sceneJson("Scene backup")
    const preview = source.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
    })
    const imported = source.foundation.services.sceneCreation.commitImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
      payloadHash: preview.payloadHash,
      expectedEpisodeRevisionNo: episode.revisionNo,
    })
    const approved = source.foundation.services.scenes.transitionStatus({
      id: imported.scenes[0]!.id,
      expectedRevisionNo: imported.scenes[0]!.revisionNo,
      status: "approved",
    })
    const slot = source.foundation.services.assetSlots.list(episode.id)[0]!
    const sourceMedia = join(source.root, "source.png")
    writeFileSync(sourceMedia, png)
    const candidate = await source.foundation.services.assets.importFile({
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: source.foundation.services.assetSlots.list(episode.id)[0]!.revisionNo,
    }, sourceMedia)
    source.foundation.services.assets.accept({ id: candidate.id, expectedRevisionNo: candidate.revisionNo })

    const backupPath = join(source.root, "metadata-v1.json")
    const exported = source.foundation.services.metadataBackup.exportTo(backupPath)
    expect(exported.summary).toMatchObject({ templates: 1, episodes: 1, scenes: 1, assetSlots: 1, assets: 1 })
    const rawBackup = readFileSync(backupPath, "utf8")
    expect(rawBackup).not.toContain("TRANSIENT_SOURCE_MUST_NOT_BE_BACKED_UP")
    expect(rawBackup).not.toContain(png.toString("base64"))

    const target = await foundation()
    const restored = target.foundation.services.metadataBackup.restoreFrom(backupPath)
    expect(restored.summary).toEqual(exported.summary)
    expect(target.foundation.services.templates.get(template.id)).toMatchObject({ id: template.id, revisionNo: template.revisionNo })
    expect(target.foundation.services.episodes.get(episode.id)).toMatchObject({ id: episode.id, sceneCount: 1, workflowStatus: "producing" })
    expect(target.foundation.services.scenes.get(approved.id)).toMatchObject({
      id: approved.id,
      narration: "Một lời dẫn đủ nội dung để Scene có thể được duyệt.",
      status: "approved",
      assetSlots: [{ id: slot.id, canonicalName: "scene-01-01", status: "fulfilled" }],
    })
    expect(target.foundation.services.assets.get(candidate.id)).toMatchObject({
      id: candidate.id,
      status: "accepted",
      fileIntegrity: "missing",
    })
    expect(() => target.foundation.services.metadataBackup.restoreFrom(backupPath))
      .toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }))
  })

  it("rejects a tampered checksum without partial writes", async () => {
    const source = await foundation()
    seedSceneTemplate(source.foundation)
    const backupPath = join(source.root, "metadata-v1.json")
    source.foundation.services.metadataBackup.exportTo(backupPath)
    const tamperedPath = join(source.root, "metadata-tampered.json")
    const document = JSON.parse(readFileSync(backupPath, "utf8")) as { payload: { templates: Array<{ name: string }> } }
    document.payload.templates[0]!.name = "Tampered name"
    writeFileSync(tamperedPath, JSON.stringify(document))

    const target = await foundation()
    expect(() => target.foundation.services.metadataBackup.restoreFrom(tamperedPath))
      .toThrowError(expect.objectContaining({ code: "BACKUP_INVALID" }))
    expect(target.foundation.services.templates.list({}).total).toBe(0)
  })
})
