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

  it("exposes the M6 Template, Episode, and thumbnail calls on one typed bridge", async () => {
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

    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      studioChannels.templatesList,
      studioChannels.templatesSaveEdit,
      studioChannels.episodesList,
      studioChannels.episodesUpdate,
      studioChannels.episodeThumbnailsImport,
      studioChannels.episodeThumbnailsRead,
    ])
  })

  it("fails fast instead of falling back when the preload bridge is absent or incomplete", () => {
    expect(() => requireStudioBridge(undefined)).toThrow("Studio preload bridge không khả dụng")
    expect(() => requireStudioBridge({ templates: {} })).toThrow("Studio preload bridge không khả dụng")
    expect(() => requireStudioBridge({} as StudioBridge)).toThrow("Studio preload bridge không khả dụng")
  })
})
