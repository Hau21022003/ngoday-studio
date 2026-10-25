import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AssetSlotRepository } from "../src/main/persistence/repositories/asset-slot-repository"
import { TemplateRepository } from "../src/main/persistence/repositories/template-repository"
import { scenesJsonV1Sample } from "../src/shared/scenes-json-v1-sample"
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
  it("covers persisted Template and Episode CRUD/list/archive flows used by M6", () => {
    const template = seedSceneTemplate(testContext.foundation)
    expect(testContext.foundation.services.templates.list({ search: "Scene Template" }).items)
      .toContainEqual(expect.objectContaining({ id: template.id, currentVersion: { major: 1, minor: 0 } }))
    const metadata = testContext.foundation.services.templates.updateMetadata({
      id: template.id,
      expectedRevisionNo: template.revisionNo,
      patch: { status: "inactive" },
    })
    expect(testContext.foundation.services.templates.get(template.id)).toMatchObject({
      status: "inactive",
      revisionNo: metadata.revisionNo,
    })

    const episode = seedEpisode(testContext.foundation, "Episode CRUD M6")
    expect(testContext.foundation.services.episodes.list({ search: "CRUD M6" }).items)
      .toContainEqual(expect.objectContaining({ id: episode.id, workflowStatus: "draft" }))
    const updated = testContext.foundation.services.episodes.update({
      id: episode.id,
      expectedRevisionNo: episode.revisionNo,
      updatedByName: "Test",
      patch: { notes: "Ghi chú CRUD" },
    })
    const archived = testContext.foundation.services.episodes.archive({
      id: episode.id,
      expectedRevisionNo: updated.revisionNo,
      updatedByName: "Test",
    })
    expect(archived.archivedAt).not.toBeNull()
    expect(testContext.foundation.services.episodes.list({}).items).not.toContainEqual(expect.objectContaining({ id: episode.id }))
    expect(testContext.foundation.services.episodes.list({ includeArchived: true }).items)
      .toContainEqual(expect.objectContaining({ id: episode.id, notes: "Ghi chú CRUD" }))
  })

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

  it("keeps the centrally managed Scenes v1 sample compatible with import preview", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const episode = seedEpisode(testContext.foundation)
    const preview = testContext.foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson: scenesJsonV1Sample,
    })

    expect(preview).toMatchObject({ sceneCount: 1, slotCount: 2, warnings: [] })
    expect(preview.document).toEqual(JSON.parse(scenesJsonV1Sample))
  })

  it("renders only the Scene Template with approved reserved variables and rejects non-Scene templates", () => {
    const variables = ["episode_title", "topic", "notes", "source_content", "episode_topic", "episode_description", "custom"].map((name) => ({
      id: randomUUID(),
      name,
      label: name,
      description: "Scene render test variable.",
      type: "text" as const,
      required: name !== "source_content",
      defaultValue: "",
      options: [],
    }))
    const template = testContext.foundation.services.templates.create({
      name: "Scene variables contract",
      description: "Template kiểm tra reserved variable mapping cho M7.",
      purpose: "scene",
      status: "active",
      content: "{{episode_title}}|{{topic}}|{{notes}}|{{source_content}}|{{episode_topic}}|{{episode_description}}|{{custom}}",
      variables,
      changeNote: "Kiểm tra M7 reserved variables.",
      createdByName: "Test",
    })
    const episode = seedEpisode(testContext.foundation, "Episode render M7")
    const updatedEpisode = testContext.foundation.services.episodes.update({
      id: episode.id,
      expectedRevisionNo: episode.revisionNo,
      updatedByName: "Test",
      patch: { notes: "Ghi chú Episode" },
    })
    const withoutSource = testContext.foundation.services.sceneCreation.renderPrompt({
      episodeId: updatedEpisode.id,
      templateVersionId: template.versions[0]!.id,
      values: { custom: "Giá trị tùy chỉnh" },
    })
    expect(withoutSource.content).toBe(
      "Episode render M7|psychology|Ghi chú Episode||psychology|Episode thử nghiệm cho persistence foundation.|Giá trị tùy chỉnh",
    )
    expect(testContext.foundation.services.sceneCreation.renderPrompt({
      episodeId: updatedEpisode.id,
      templateVersionId: template.versions[0]!.id,
      sourceContent: "Nội dung chỉ trong phiên",
      values: {
        episode_title: "Renderer không được ghi đè",
        source_content: "Renderer cũng không được ghi đè source",
        custom: "Giá trị tùy chỉnh",
      },
    }).content).toBe(
      "Episode render M7|psychology|Ghi chú Episode|Nội dung chỉ trong phiên|psychology|Episode thử nghiệm cho persistence foundation.|Giá trị tùy chỉnh",
    )

    const wrongPurpose = testContext.foundation.services.templates.create({
      name: "Thumbnail template M7",
      description: "Template khác purpose không được dùng để tạo Scenes.",
      purpose: "thumbnail",
      status: "active",
      content: "Tạo thumbnail.",
      variables: [],
      changeNote: "Kiểm tra purpose guard.",
      createdByName: "Test",
    })
    expect(() => testContext.foundation.services.sceneCreation.validateImport({
      episodeId: updatedEpisode.id,
      templateVersionId: wrongPurpose.versions[0]!.id,
      mode: "append",
      rawJson: sceneJson(),
    })).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }))
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

  it("saves Template metadata and an immutable version atomically", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const originalVersion = template.versions[0]!
    const edited = testContext.foundation.services.templates.saveEdit({
      id: template.id,
      expectedRevisionNo: template.revisionNo,
      patch: { name: "Scene Template đã chỉnh sửa" },
      version: {
        content: originalVersion.content.replace("Tạo scenes", "Hãy tạo scenes"),
        variables: originalVersion.variables,
        changeNote: "Lưu metadata và version trong cùng transaction.",
        createdByName: "Test",
      },
    })

    expect(edited).toMatchObject({ name: "Scene Template đã chỉnh sửa", revisionNo: 2 })
    expect(edited.versions).toHaveLength(2)
    expect(edited.versions[1]).toMatchObject({ id: originalVersion.id, content: originalVersion.content })
  })

  it("rolls back Template metadata when atomic version append fails", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const originalVersion = template.versions[0]!
    vi.spyOn(TemplateRepository.prototype, "insertVersion").mockImplementationOnce(() => {
      throw new Error("fixture version failure")
    })

    expect(() => testContext.foundation.services.templates.saveEdit({
      id: template.id,
      expectedRevisionNo: template.revisionNo,
      patch: { name: "Tên không được commit một phần" },
      version: {
        content: originalVersion.content,
        variables: originalVersion.variables,
        changeNote: "Kích hoạt rollback transaction.",
        createdByName: "Test",
      },
    })).toThrow("fixture version failure")

    const persisted = testContext.foundation.services.templates.get(template.id)
    expect(persisted).toMatchObject({ name: template.name, revisionNo: 1 })
    expect(persisted.versions).toHaveLength(1)
  })

  it("imports and reads only validated Episode thumbnails inside the workspace", () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
    const imported = testContext.foundation.services.episodeThumbnails.import({
      fileName: "thumbnail.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
    })

    expect(imported).toMatchObject({ mimeType: "image/png" })
    expect(imported.relativePath).toMatch(/^thumbnails\/[a-f0-9]{64}\.png$/)
    expect(testContext.foundation.services.episodeThumbnails.read({ relativePath: imported.relativePath })).toEqual(imported)
    expect(() => testContext.foundation.services.episodeThumbnails.read({ relativePath: "../outside.png" }))
      .toThrowError(expect.objectContaining({ code: "FILE_OUTSIDE_WORKSPACE" }))
    expect(() => testContext.foundation.services.episodeThumbnails.import({
      fileName: "fake.png",
      mimeType: "image/png",
      dataBase64: Buffer.from("not an image").toString("base64"),
    })).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }))
    expect(() => testContext.foundation.services.episodeThumbnails.import({
      fileName: "too-large.png",
      mimeType: "image/png",
      dataBase64: Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64"),
    })).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }))
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
    expect(() => testContext.foundation.services.scenes.reorder({
      episodeId: episode.id,
      orderedSceneIds: [imported.scenes[0]!.id, imported.scenes[1]!.id],
      expectedEpisodeRevisionNo: imported.episodeRevisionNo,
    })).toThrowError(expect.objectContaining({ code: "STALE_REVISION" }))
  })

  it("persists Scene edits, preserves approval for notes, and demotes approved content changes", () => {
    const template = seedSceneTemplate(testContext.foundation)
    const episode = seedEpisode(testContext.foundation)
    const rawJson = sceneJson("Scene review")
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
      expectedEpisodeRevisionNo: episode.revisionNo,
    })
    const approved = testContext.foundation.services.scenes.transitionStatus({
      id: imported.scenes[0]!.id,
      status: "approved",
      expectedRevisionNo: 1,
    })
    const notesOnly = testContext.foundation.services.scenes.update({
      id: approved.id,
      expectedRevisionNo: approved.revisionNo,
      patch: { notes: "Ghi chú không hạ approval" },
    })
    expect(notesOnly).toMatchObject({ status: "approved", notes: "Ghi chú không hạ approval" })

    const contentEdit = testContext.foundation.services.scenes.update({
      id: notesOnly.id,
      expectedRevisionNo: notesOnly.revisionNo,
      patch: { narration: "Narration đã chỉnh sửa sau approval." },
    })
    expect(contentEdit).toMatchObject({ status: "draft", approvedAt: null })
    expect(() => testContext.foundation.services.scenes.update({
      id: contentEdit.id,
      expectedRevisionNo: notesOnly.revisionNo,
      patch: { title: "Không được ghi đè bằng revision cũ" },
    })).toThrowError(expect.objectContaining({ code: "STALE_REVISION" }))
    const invalid = testContext.foundation.services.scenes.update({
      id: contentEdit.id,
      expectedRevisionNo: contentEdit.revisionNo,
      patch: { narration: "" },
    })
    expect(() => testContext.foundation.services.scenes.transitionStatus({
      id: invalid.id,
      status: "approved",
      expectedRevisionNo: invalid.revisionNo,
    })).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }))
  })

  it("keeps Asset lifecycle accepted when file integrity becomes missing or mismatched", async () => {
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
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0])
    writeFileSync(mediaPath, bytes)
    const candidate = await testContext.foundation.services.assets.importFile({
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: slot.revisionNo,
    }, mediaPath)
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

    const managedPath = join(testContext.workspace, candidate.relativePath!)
    unlinkSync(managedPath)
    expect(testContext.foundation.services.assets.get(candidate.id)).toMatchObject({
      status: "accepted",
      fileIntegrity: "missing",
    })
    expect(testContext.foundation.services.episodes.get(episode.id).workflowStatus).toBe("producing")

    writeFileSync(managedPath, "different bytes")
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
