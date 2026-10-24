import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { sha256 } from "../src/main/domain/helpers"
import { AssetSlotRepository } from "../src/main/persistence/repositories/asset-slot-repository"
import type { TempFoundation } from "./helpers/temp-foundation"
import { createTempFoundation } from "./helpers/temp-foundation"
import { sceneJson, seedEpisode, seedSceneTemplate } from "./helpers/seed"

let testContext: TempFoundation

beforeEach(async () => {
  testContext = await createTempFoundation()
})

afterEach(() => {
  testContext.cleanup()
})

describe("persistence services", () => {
  it("validates the anonymized Scenes v1 fixture used at the import boundary", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const episode = seedEpisode(testContext.foundation)
    const rawJson = readFileSync(new URL("./fixtures/scenes-v1.valid.json", import.meta.url), "utf8")
    const preview = testContext.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
    })
    expect(preview).toMatchObject({ sceneCount: 2, slotCount: 3, warnings: [] })
    expect(preview.document.scenes.map((scene) => scene.order)).toEqual([1, 2])
  })

  it("keeps TemplateVersion immutable and guards metadata/version concurrency", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const initial = template.versions[0]!
    const version = testContext.foundation.services.templates.createVersion({
      templateId: template.id,
      expectedTemplateRevisionNo: 1,
      content: initial.content.replace("Tạo scenes", "Hãy tạo scenes"),
      variables: initial.variables,
      changeNote: "Tinh chỉnh câu lệnh render.",
      createdByName: "Test",
    })
    expect(version).toMatchObject({ major: 1, minor: 1 })
    const aggregate = testContext.foundation.services.templates.get(template.id)
    expect(aggregate.versions).toHaveLength(2)
    expect(aggregate.versions[1]).toMatchObject({ id: initial.id, content: initial.content })
    expect(() =>
      testContext.foundation.services.templates.createVersion({
        templateId: template.id,
        expectedTemplateRevisionNo: 1,
        content: initial.content,
        variables: initial.variables,
        changeNote: "Ghi đè stale version.",
        createdByName: "Test",
      }),
    ).toThrowError(expect.objectContaining({ code: "STALE_REVISION" }))
  })

  it("enforces optimistic concurrency on current-state records", () => {
    const episode = seedEpisode(testContext.foundation)
    const updated = testContext.foundation.services.episodes.update({
      id: episode.id,
      expectedRevisionNo: 1,
      updatedByName: "Test",
      patch: { notes: "Bản cập nhật đầu tiên" },
    })
    expect(updated.revisionNo).toBe(2)
    expect(() =>
      testContext.foundation.services.episodes.update({
        id: episode.id,
        expectedRevisionNo: 1,
        updatedByName: "Test",
        patch: { notes: "Ghi đè stale" },
      }),
    ).toThrowError(expect.objectContaining({ code: "STALE_REVISION" }))
  })

  it("previews fenced JSON, creates provenance, appends, and replaces asset-free scenes atomically", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const version = template.versions[0]!
    const episode = seedEpisode(testContext.foundation)
    const fenced = `\`\`\`json\n${sceneJson("Hook") }\n\`\`\``
    const preview = testContext.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: version.id,
      mode: "append",
      rawJson: fenced,
    })
    expect(preview.warnings).toEqual([
      "Đã bóc outer Markdown JSON fence trước khi validate.",
      "Đã tạo required AssetSlot mặc định cho 1 Scene.",
    ])
    const first = testContext.foundation.services.sceneCreation.commitImport({
      episodeId: episode.id,
      templateVersionId: version.id,
      mode: "append",
      rawJson: fenced,
      payloadHash: preview.payloadHash,
      expectedEpisodeRevisionNo: 1,
    })
    expect(first.scenes[0]).toMatchObject({ displayOrder: 1, canonicalNo: 1, status: "draft" })
    expect(first.assetSlots[0]).toMatchObject({ canonicalName: "scene-01-01", status: "draft", required: true })
    expect(testContext.foundation.services.scenes.get(first.scenes[0]!.id).provenance).toMatchObject({
      id: first.importBatchId,
      templateVersionId: version.id,
    })

    const appendJson = sceneJson("Mở đầu")
    const appendPreview = testContext.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: version.id,
      mode: "append",
      rawJson: appendJson,
    })
    const appended = testContext.foundation.services.sceneCreation.commitImport({
      episodeId: episode.id,
      templateVersionId: version.id,
      mode: "append",
      rawJson: appendJson,
      payloadHash: appendPreview.payloadHash,
      expectedEpisodeRevisionNo: 2,
    })
    expect(appended.scenes[0]).toMatchObject({ displayOrder: 2, canonicalNo: 2 })

    const replacementJson = sceneJson("Cảnh thay thế")
    const replacementPreview = testContext.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: version.id,
      mode: "replace",
      rawJson: replacementJson,
    })
    const replacement = testContext.foundation.services.sceneCreation.commitImport({
      episodeId: episode.id,
      templateVersionId: version.id,
      mode: "replace",
      rawJson: replacementJson,
      payloadHash: replacementPreview.payloadHash,
      expectedEpisodeRevisionNo: 3,
    })
    expect(replacement.scenes).toHaveLength(1)
    expect(replacement.scenes[0]).toMatchObject({ title: "Cảnh thay thế", displayOrder: 1, canonicalNo: 1 })
    expect(testContext.foundation.services.scenes.list(episode.id)).toHaveLength(1)
  })

  it("rolls back batch, scenes, slots, and episode revision when import insertion fails", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const episode = seedEpisode(testContext.foundation)
    const rawJson = sceneJson()
    const preview = testContext.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
    })
    vi.spyOn(AssetSlotRepository.prototype, "insertMany").mockImplementationOnce(() => {
      throw new Error("fixture insertion failure")
    })

    expect(() =>
      testContext.foundation.services.sceneCreation.commitImport({
        episodeId: episode.id,
        templateVersionId: template.versions[0]!.id,
        mode: "append",
        rawJson,
        payloadHash: preview.payloadHash,
        expectedEpisodeRevisionNo: 1,
      }),
    ).toThrow("fixture insertion failure")
    expect(testContext.foundation.services.scenes.list(episode.id)).toEqual([])
    expect(testContext.foundation.services.episodes.get(episode.id).revisionNo).toBe(1)
    expect(
      testContext.foundation.database.connection.prepare("SELECT COUNT(*) AS total FROM scene_import_batches").get(),
    ).toEqual({ total: 0 })
  })

  it("reorders display order without changing canonical numbers", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const episode = seedEpisode(testContext.foundation)
    const rawJson = JSON.stringify({
      schemaVersion: 1,
      scenes: [
        {
          order: 1,
          title: "Scene A",
          narration: "Narration A",
          visualDescription: "Visual A",
          sceneType: "ENVIRONMENT",
          mediaType: "image",
        },
        {
          order: 2,
          title: "Scene B",
          narration: "Narration B",
          visualDescription: "Visual B",
          sceneType: "B_ROLL",
          mediaType: "video",
        },
      ],
    })
    const preview = testContext.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
    })
    const imported = testContext.foundation.services.sceneCreation.commitImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
      payloadHash: preview.payloadHash,
      expectedEpisodeRevisionNo: 1,
    })
    const reordered = testContext.foundation.services.scenes.reorder({
      episodeId: episode.id,
      orderedSceneIds: [imported.scenes[1]!.id, imported.scenes[0]!.id],
      expectedEpisodeRevisionNo: 2,
    })
    expect(reordered.map((scene) => ({ title: scene.title, displayOrder: scene.displayOrder, canonicalNo: scene.canonicalNo }))).toEqual([
      { title: "Scene B", displayOrder: 1, canonicalNo: 2 },
      { title: "Scene A", displayOrder: 2, canonicalNo: 1 },
    ])
  })

  it("keeps Asset lifecycle accepted when file integrity becomes missing or mismatched", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const episode = seedEpisode(testContext.foundation)
    const rawJson = sceneJson()
    const preview = testContext.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
    })
    const imported = testContext.foundation.services.sceneCreation.commitImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
      payloadHash: preview.payloadHash,
      expectedEpisodeRevisionNo: 1,
    })
    const slot = testContext.foundation.services.assetSlots.list(episode.id)[0]!
    const mediaDirectory = join(testContext.workspace, "media")
    mkdirSync(mediaDirectory, { recursive: true })
    const mediaPath = join(mediaDirectory, "scene-01-01.png")
    const bytes = Buffer.from("valid media fixture")
    writeFileSync(mediaPath, bytes)
    const candidate = testContext.foundation.services.assets.registerImported({
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: slot.revisionNo,
      promptSnapshot: slot.prompt,
      sourcePath: "media/scene-01-01.png",
      mimeType: "image/png",
      bytes: bytes.length,
      sha256: sha256(bytes),
      width: 1280,
      height: 720,
    })
    expect(candidate).toMatchObject({ status: "candidate", fileIntegrity: "available" })
    expect(() =>
      testContext.foundation.services.assets.accept({ id: candidate.id, expectedRevisionNo: 1 }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }))

    const approved = testContext.foundation.services.scenes.transitionStatus({
      id: imported.scenes[0]!.id,
      status: "approved",
      expectedRevisionNo: 1,
    })
    expect(approved.status).toBe("approved")
    expect(testContext.foundation.services.assetSlots.list(episode.id)[0]).toMatchObject({ status: "ready", revisionNo: 3 })

    const accepted = testContext.foundation.services.assets.accept({ id: candidate.id, expectedRevisionNo: 1 })
    expect(accepted).toMatchObject({ status: "accepted", fileIntegrity: "available", revisionNo: 2 })
    expect(testContext.foundation.services.episodes.get(episode.id).workflowStatus).toBe("ready_to_export")

    unlinkSync(mediaPath)
    expect(testContext.foundation.services.assets.get(candidate.id)).toMatchObject({
      status: "accepted",
      fileIntegrity: "missing",
    })
    expect(testContext.foundation.services.episodes.get(episode.id).workflowStatus).toBe("producing")

    writeFileSync(mediaPath, "different bytes")
    expect(testContext.foundation.services.assets.get(candidate.id)).toMatchObject({
      status: "accepted",
      fileIntegrity: "hash_mismatch",
    })
    expect(() =>
      testContext.foundation.services.assets.reject({ id: candidate.id, expectedRevisionNo: 1 }),
    ).toThrowError(expect.objectContaining({ code: "STALE_REVISION" }))
    expect(() =>
      testContext.foundation.services.sceneCreation.validateImport({
        episodeId: episode.id,
        templateVersionId: template.versions[0]!.id,
        mode: "replace",
        rawJson,
      }),
    ).toThrowError(expect.objectContaining({ code: "SCENES_REPLACE_CONFLICT" }))
  })
})
