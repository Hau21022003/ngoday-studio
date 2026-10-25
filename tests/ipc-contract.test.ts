import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  registerStudioIpc,
  registerValidatedHandler,
  type IpcRegistrar,
} from "../src/main/ipc/register-studio-ipc"
import { studioChannels } from "../src/shared/ipc"
import type { TempFoundation } from "./helpers/temp-foundation"
import { createTempFoundation } from "./helpers/temp-foundation"
import { sceneJson, seedEpisode, seedSceneTemplate } from "./helpers/seed"

class FakeRegistrar implements IpcRegistrar {
  readonly handlers = new Map<string, (event: unknown, input: unknown) => unknown>()

  handle(channel: string, listener: (event: unknown, input: unknown) => unknown) {
    this.handlers.set(channel, listener)
  }

  async invoke(channel: string, input: unknown) {
    const handler = this.handlers.get(channel)
    if (!handler) throw new Error(`Missing handler ${channel}`)
    return handler({}, input)
  }
}

let testContext: TempFoundation
let registrar: FakeRegistrar

beforeEach(async () => {
  testContext = await createTempFoundation()
  registrar = new FakeRegistrar()
  registerStudioIpc(registrar, testContext.foundation)
})

afterEach(() => testContext.cleanup())

describe("typed IPC boundary", () => {
  it("registers explicit use-case channels and rejects invalid input", async () => {
    expect(registrar.handlers.has(studioChannels.episodesCreate)).toBe(true)
    expect(registrar.handlers.has(studioChannels.templatesSaveEdit)).toBe(true)
    expect(registrar.handlers.has(studioChannels.episodeThumbnailsImport)).toBe(true)
    expect(registrar.handlers.has(studioChannels.episodeThumbnailsRead)).toBe(true)
    expect([...registrar.handlers.keys()].some((channel) => channel.includes("execute-sql"))).toBe(false)
    await expect(
      registrar.invoke(studioChannels.episodesCreate, {
        title: "x",
        topic: "unknown",
        description: "short",
        createdByName: "Test",
        extra: true,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR", retryable: false } })
  })

  it("exposes atomic Template edit and restricted thumbnail use cases", async () => {
    const template = seedSceneTemplate(testContext.foundation)
    const currentVersion = template.versions[0]!
    const edited = await registrar.invoke(studioChannels.templatesSaveEdit, {
      id: template.id,
      expectedRevisionNo: template.revisionNo,
      patch: { description: "Template đã được cập nhật nguyên tử qua typed IPC." },
      version: {
        content: currentVersion.content,
        variables: currentVersion.variables,
        changeNote: "Tạo immutable version qua IPC.",
        createdByName: "Test",
      },
    })
    expect(edited).toMatchObject({
      ok: true,
      data: { revisionNo: 2, versions: [{ minor: 1 }, { minor: 0 }] },
    })

    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
    const imported = await registrar.invoke(studioChannels.episodeThumbnailsImport, {
      fileName: "ipc.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
    }) as { ok: true; data: { relativePath: string } }
    expect(imported).toMatchObject({ ok: true, data: { mimeType: "image/png" } })
    await expect(registrar.invoke(studioChannels.episodeThumbnailsRead, {
      relativePath: imported.data.relativePath,
    })).resolves.toMatchObject({ ok: true, data: { dataUrl: expect.stringMatching(/^data:image\/png;base64,/) } })
    await expect(registrar.invoke(studioChannels.episodeThumbnailsRead, {
      relativePath: "../outside.png",
    })).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } })
  })

  it("returns a validated response envelope for valid commands", async () => {
    const result = await registrar.invoke(studioChannels.episodesCreate, {
      title: "Episode qua IPC",
      topic: "science",
      description: "Mô tả Episode hợp lệ được tạo qua typed IPC.",
      createdByName: "Test",
    })
    expect(result).toMatchObject({
      ok: true,
      data: { title: "Episode qua IPC", topic: "science", revisionNo: 1, archivedAt: null },
    })
  })

  it("runs the M7 render, strict import, edit, approval, and reorder use cases through typed IPC", async () => {
    const template = seedSceneTemplate(testContext.foundation)
    const episode = seedEpisode(testContext.foundation, "Episode IPC M7")
    const versionId = template.versions[0]!.id
    await expect(registrar.invoke(studioChannels.sceneCreationRenderPrompt, {
      episodeId: episode.id,
      templateVersionId: versionId,
      sourceContent: "Nội dung tạm",
    })).resolves.toMatchObject({ ok: true, data: { content: expect.stringContaining("Episode IPC M7") } })

    const rawJson = sceneJson("Scene IPC")
    const preview = await registrar.invoke(studioChannels.sceneCreationValidateImport, {
      episodeId: episode.id,
      templateVersionId: versionId,
      mode: "append",
      rawJson,
    }) as { ok: true; data: { payloadHash: string } }
    const imported = await registrar.invoke(studioChannels.sceneCreationCommitImport, {
      episodeId: episode.id,
      templateVersionId: versionId,
      mode: "append",
      rawJson,
      payloadHash: preview.data.payloadHash,
      expectedEpisodeRevisionNo: episode.revisionNo,
    }) as { ok: true; data: { scenes: Array<{ id: string; revisionNo: number }>; episodeRevisionNo: number } }
    const scene = imported.data.scenes[0]!

    await expect(registrar.invoke(studioChannels.scenesUpdate, {
      id: scene.id,
      expectedRevisionNo: scene.revisionNo,
      patch: { summary: "Summary đã lưu qua IPC" },
    })).resolves.toMatchObject({ ok: true, data: { summary: "Summary đã lưu qua IPC", revisionNo: 2 } })
    await expect(registrar.invoke(studioChannels.scenesTransitionStatus, {
      id: scene.id,
      expectedRevisionNo: 2,
      status: "approved",
    })).resolves.toMatchObject({ ok: true, data: { status: "approved", revisionNo: 3 } })
    await expect(registrar.invoke(studioChannels.scenesReorder, {
      episodeId: episode.id,
      orderedSceneIds: [scene.id],
      expectedEpisodeRevisionNo: imported.data.episodeRevisionNo,
    })).resolves.toMatchObject({ ok: true, data: [{ id: scene.id, canonicalNo: 1, displayOrder: 1 }] })

    await expect(registrar.invoke(studioChannels.sceneCreationValidateImport, {
      episodeId: episode.id,
      templateVersionId: versionId,
      mode: "append",
      rawJson: JSON.stringify({ schemaVersion: 1, scenes: [{ order: 1, title: "Bad", status: "approved" }] }),
    })).resolves.toMatchObject({ ok: false, error: { code: "IMPORT_INVALID" } })
  })

  it("keeps M8 file paths in main and exposes validated Asset and backup use cases", async () => {
    const template = seedSceneTemplate(testContext.foundation)
    const episode = seedEpisode(testContext.foundation, "Episode IPC M8")
    const rawJson = sceneJson("Asset IPC")
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
    testContext.foundation.services.scenes.transitionStatus({ id: imported.scenes[0]!.id, expectedRevisionNo: 1, status: "approved" })
    const slot = testContext.foundation.services.assetSlots.list(episode.id)[0]!
    const sourcePath = join(testContext.root, "ipc-asset.png")
    const backupPath = join(testContext.root, "ipc-backup.json")
    writeFileSync(sourcePath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]))
    const opened: string[] = []
    const revealed: string[] = []
    registerStudioIpc(registrar, testContext.foundation, {
      chooseAssetFile: async () => sourcePath,
      chooseMetadataBackupDestination: async () => backupPath,
      chooseMetadataBackupSource: async () => null,
      openFile: async (path) => { opened.push(path) },
      revealFile: (path) => { revealed.push(path) },
    })

    await expect(registrar.invoke(studioChannels.assetsImportFile, {
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: slot.revisionNo,
      sourcePath: "renderer-must-not-send-this.png",
    })).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } })
    const importedAsset = await registrar.invoke(studioChannels.assetsImportFile, {
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: slot.revisionNo,
    }) as { ok: true; data: { asset: { id: string; fileIntegrity: string } } }
    expect(importedAsset).toMatchObject({ ok: true, data: { cancelled: false, asset: { fileIntegrity: "available" } } })
    await expect(registrar.invoke(studioChannels.assetsVerifyIntegrity, { id: importedAsset.data.asset.id }))
      .resolves.toMatchObject({ ok: true, data: { status: "candidate", fileIntegrity: "available" } })
    await registrar.invoke(studioChannels.assetsOpenFile, { id: importedAsset.data.asset.id })
    await registrar.invoke(studioChannels.assetsRevealFile, { id: importedAsset.data.asset.id })
    expect(opened).toHaveLength(1)
    expect(revealed).toEqual(opened)
    await expect(registrar.invoke(studioChannels.metadataBackupExport, {}))
      .resolves.toMatchObject({ ok: true, data: { cancelled: false, fileName: "ipc-backup.json", summary: { assets: 1 } } })
  })

  it("maps optimistic concurrency conflicts to a typed IPC error without overwriting data", async () => {
    const created = await registrar.invoke(studioChannels.episodesCreate, {
      title: "Episode conflict IPC",
      topic: "science",
      description: "Mô tả hợp lệ để kiểm tra optimistic concurrency qua IPC.",
      createdByName: "Test",
    }) as { ok: true; data: { id: string } }
    const first = await registrar.invoke(studioChannels.episodesUpdate, {
      id: created.data.id,
      expectedRevisionNo: 1,
      updatedByName: "Test",
      patch: { notes: "Bản ghi đã lưu" },
    })
    expect(first).toMatchObject({ ok: true, data: { notes: "Bản ghi đã lưu", revisionNo: 2 } })

    await expect(registrar.invoke(studioChannels.episodesUpdate, {
      id: created.data.id,
      expectedRevisionNo: 1,
      updatedByName: "Test",
      patch: { notes: "Bản stale không được ghi đè" },
    })).resolves.toMatchObject({ ok: false, error: { code: "STALE_REVISION", retryable: false } })
    await expect(registrar.invoke(studioChannels.episodesGet, { id: created.data.id }))
      .resolves.toMatchObject({ ok: true, data: { notes: "Bản ghi đã lưu", revisionNo: 2 } })
  })

  it("fails closed when a handler returns a response outside its schema", async () => {
    const isolated = new FakeRegistrar()
    registerValidatedHandler(isolated, "test:response", z.object({ value: z.string() }), z.object({ id: z.string().uuid() }), () => ({ id: "not-a-uuid" }))
    await expect(isolated.invoke("test:response", { value: "ok" })).resolves.toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Response nội bộ không đúng contract.", retryable: false },
    })
  })
})
