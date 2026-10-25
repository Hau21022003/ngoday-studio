import { describe, expect, it, vi } from "vitest"

import { createStudioBridge, type StudioInvoke } from "../src/preload/studio-bridge"
import { requireStudioBridge } from "../src/renderer/src/data/studio-client"
import { studioChannels, type StudioBridge } from "../src/shared/ipc"
import { preloadEntryFileName, preloadModuleFormat } from "../src/shared/runtime-paths"

describe("preload bridge regression", () => {
  it("uses a CommonJS preload artifact compatible with an Electron sandbox", () => {
    expect(preloadModuleFormat).toBe("cjs")
    expect(preloadEntryFileName).toBe("index.cjs")
  })

  it("exposes the M6 and M7 use cases on one typed bridge", async () => {
    const invoke = vi.fn(async () => ({ ok: true, data: null })) as unknown as StudioInvoke
    const bridge = createStudioBridge(invoke, {
      platform: "win32",
      versions: { electron: "test", chrome: "test" },
    })
    const templateId = "00000000-0000-4000-8000-000000000001"

    requireStudioBridge(bridge)
    await bridge.templates.list({ page: 1, pageSize: 100 })
    await bridge.templates.saveEdit({ id: templateId, expectedRevisionNo: 1, patch: { status: "active" } })
    await bridge.episodes.list({ page: 1, pageSize: 100 })
    await bridge.episodes.update({ id: templateId, expectedRevisionNo: 1, updatedByName: "Test", patch: { notes: "draft" } })
    await bridge.episodeThumbnails.import({ fileName: "thumb.png", mimeType: "image/png", dataBase64: "iVBORw==" })
    await bridge.episodeThumbnails.read({ relativePath: "thumbnails/thumb.png" })
    await bridge.sceneCreation.renderPrompt({ episodeId: templateId, templateVersionId: templateId })
    await bridge.sceneCreation.validateImport({ episodeId: templateId, templateVersionId: templateId, mode: "append", rawJson: "{}" })
    await bridge.sceneCreation.commitImport({ episodeId: templateId, templateVersionId: templateId, mode: "append", rawJson: "{}", payloadHash: "a".repeat(64), expectedEpisodeRevisionNo: 1 })
    await bridge.scenes.get({ id: templateId })
    await bridge.scenes.update({ id: templateId, expectedRevisionNo: 1, patch: { notes: "draft" } })
    await bridge.scenes.reorder({ episodeId: templateId, orderedSceneIds: [templateId], expectedEpisodeRevisionNo: 1 })
    await bridge.scenes.transitionStatus({ id: templateId, status: "approved", expectedRevisionNo: 1 })
    await bridge.assetSlots.list({ episodeId: templateId })

    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      studioChannels.templatesList,
      studioChannels.templatesSaveEdit,
      studioChannels.episodesList,
      studioChannels.episodesUpdate,
      studioChannels.episodeThumbnailsImport,
      studioChannels.episodeThumbnailsRead,
      studioChannels.sceneCreationRenderPrompt,
      studioChannels.sceneCreationValidateImport,
      studioChannels.sceneCreationCommitImport,
      studioChannels.scenesGet,
      studioChannels.scenesUpdate,
      studioChannels.scenesReorder,
      studioChannels.scenesTransitionStatus,
      studioChannels.assetSlotsList,
    ])
  })

  it("fails fast instead of falling back when the preload bridge is absent or incomplete", () => {
    expect(() => requireStudioBridge(undefined)).toThrow("Studio preload bridge không khả dụng")
    expect(() => requireStudioBridge({ templates: {} })).toThrow("Studio preload bridge không khả dụng")
    expect(() => requireStudioBridge({} as StudioBridge)).toThrow("Studio preload bridge không khả dụng")
  })
})
