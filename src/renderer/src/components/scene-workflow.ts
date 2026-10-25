import type { AssetSlot, Scene, UpdateSceneCommand } from "../../../shared/domain"

type SceneDraft = Pick<
  Scene,
  "title" | "summary" | "narration" | "visualDescription" | "sceneType" | "defaultMediaType" | "notes"
>

const reservedSceneVariableNames = new Set([
  "episode_title",
  "topic",
  "notes",
  "source_content",
  "episode_topic",
  "episode_description",
])

function sceneToDraft(scene: Scene): SceneDraft {
  return {
    title: scene.title,
    summary: scene.summary,
    narration: scene.narration,
    visualDescription: scene.visualDescription,
    sceneType: scene.sceneType,
    defaultMediaType: scene.defaultMediaType,
    notes: scene.notes,
  }
}

function sceneDraftPatch(scene: Scene, draft: SceneDraft): UpdateSceneCommand["patch"] {
  const patch: UpdateSceneCommand["patch"] = {}
  for (const key of Object.keys(draft) as Array<keyof SceneDraft>) {
    if (draft[key] !== scene[key]) {
      Object.assign(patch, { [key]: draft[key] })
    }
  }
  return patch
}

function validateSceneDraft(draft: SceneDraft, requireApprovable = false) {
  const errors: Partial<Record<keyof SceneDraft, string>> = {}
  if (!draft.title.trim()) errors.title = "Tiêu đề là bắt buộc."
  else if (draft.title.trim().length > 120) errors.title = "Tối đa 120 ký tự."
  if (draft.summary.length > 500) errors.summary = "Tối đa 500 ký tự."
  if (requireApprovable && !draft.narration.trim()) errors.narration = "Narration là bắt buộc trước khi duyệt."
  else if (draft.narration.length > 10_000) errors.narration = "Tối đa 10.000 ký tự."
  if (requireApprovable && !draft.visualDescription.trim()) errors.visualDescription = "Mô tả hình ảnh là bắt buộc trước khi duyệt."
  else if (draft.visualDescription.length > 5_000) errors.visualDescription = "Tối đa 5.000 ký tự."
  if (draft.notes.length > 2_000) errors.notes = "Tối đa 2.000 ký tự."
  return errors
}

function moveSceneId(ids: string[], sceneId: string, direction: -1 | 1) {
  const index = ids.indexOf(sceneId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids
  const next = [...ids]
  const [moved] = next.splice(index, 1)
  if (!moved) return ids
  next.splice(nextIndex, 0, moved)
  return next
}

function dropSceneId(ids: string[], draggedId: string, targetId: string) {
  if (draggedId === targetId) return ids
  const from = ids.indexOf(draggedId)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0) return ids
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  if (!moved) return ids
  next.splice(to, 0, moved)
  return next
}

function sceneStructureSignature(scenes: Scene[]) {
  return [...scenes]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((scene) => `${scene.id}:${scene.displayOrder}:${scene.canonicalNo}`)
    .join("|")
}

function orderChanged(scenes: Scene[], orderedIds: string[]) {
  const current = [...scenes].sort((left, right) => left.displayOrder - right.displayOrder).map((scene) => scene.id)
  return current.some((id, index) => id !== orderedIds[index])
}

function slotsByScene(slots: AssetSlot[]) {
  const result = new Map<string, AssetSlot[]>()
  for (const slot of slots) {
    const current = result.get(slot.sceneId) ?? []
    current.push(slot)
    result.set(slot.sceneId, current)
  }
  for (const current of result.values()) current.sort((left, right) => left.slotOrder - right.slotOrder)
  return result
}

export {
  dropSceneId,
  moveSceneId,
  orderChanged,
  reservedSceneVariableNames,
  sceneDraftPatch,
  sceneStructureSignature,
  sceneToDraft,
  slotsByScene,
  validateSceneDraft,
}
export type { SceneDraft }
