import { describe, expect, it } from "vitest"

import {
  dropSceneId,
  moveSceneId,
  orderChanged,
  sceneDraftPatch,
  sceneStructureSignature,
  sceneToDraft,
  slotsByScene,
  validateSceneDraft,
} from "../src/renderer/src/components/scene-workflow"
import type { AssetSlot, Scene } from "../src/shared/domain"

function scene(id: string, displayOrder: number, canonicalNo: number): Scene {
  return {
    id,
    episodeId: "episode",
    displayOrder,
    canonicalNo,
    title: `Scene ${id}`,
    summary: "Tóm tắt",
    narration: "Lời dẫn",
    visualDescription: "Mô tả hình ảnh",
    sceneType: "ENVIRONMENT",
    defaultMediaType: "image",
    notes: "",
    status: "draft",
    sourceImportBatchId: null,
    revisionNo: 1,
    approvedAt: null,
    createdAt: "2026-10-25T00:00:00.000Z",
    updatedAt: "2026-10-25T00:00:00.000Z",
  }
}

describe("M7 renderer Scene workflow", () => {
  it("creates an allowlisted patch and validates approval fields without mutating the source Scene", () => {
    const current = scene("a", 1, 7)
    const draft = sceneToDraft(current)
    draft.notes = "Ghi chú mới"

    expect(sceneDraftPatch(current, draft)).toEqual({ notes: "Ghi chú mới" })
    expect(current.notes).toBe("")
    draft.narration = ""
    draft.visualDescription = " "
    expect(validateSceneDraft(draft, true)).toMatchObject({
      narration: expect.stringContaining("bắt buộc"),
      visualDescription: expect.stringContaining("bắt buộc"),
    })
  })

  it("keeps canonical structure stable while drafting a complete display-order permutation", () => {
    const scenes = [scene("a", 1, 10), scene("b", 2, 20), scene("c", 3, 30)]
    const signature = sceneStructureSignature(scenes)
    const moved = moveSceneId(["a", "b", "c"], "b", -1)
    const dropped = dropSceneId(moved, "c", "a")

    expect(moved).toEqual(["b", "a", "c"])
    expect(dropped).toEqual(["b", "c", "a"])
    expect(orderChanged(scenes, dropped)).toBe(true)
    expect(sceneStructureSignature(scenes)).toBe(signature)
    expect(scenes.map((item) => item.canonicalNo)).toEqual([10, 20, 30])
  })

  it("groups imported media prompts by Scene and preserves slot order", () => {
    const makeSlot = (id: string, sceneId: string, slotOrder: number): AssetSlot => ({
      id,
      episodeId: "episode",
      sceneId,
      slotOrder,
      canonicalName: `scene-01-${String(slotOrder).padStart(2, "0")}`,
      canonicalNameKey: `scene-01-${String(slotOrder).padStart(2, "0")}`,
      mediaType: "image",
      prompt: `Prompt ${slotOrder}`,
      required: true,
      status: "draft",
      revisionNo: 1,
      createdAt: "2026-10-25T00:00:00.000Z",
      updatedAt: "2026-10-25T00:00:00.000Z",
    })
    const grouped = slotsByScene([makeSlot("two", "scene", 2), makeSlot("one", "scene", 1)])
    expect(grouped.get("scene")?.map((slot) => slot.slotOrder)).toEqual([1, 2])
  })
})
