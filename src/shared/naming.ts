export function canonicalAssetName(sceneOrder: number, assetOrder: number): string {
  if (!Number.isInteger(sceneOrder) || sceneOrder < 1) {
    throw new Error('sceneOrder must be a positive integer');
  }
  if (!Number.isInteger(assetOrder) || assetOrder < 1) {
    throw new Error('assetOrder must be a positive integer');
  }
  return `scene-${String(sceneOrder).padStart(2, '0')}-${String(assetOrder).padStart(2, '0')}`;
}

export interface CanonicalNameChange {
  slotId: string;
  from: string;
  to: string;
}

export function planCanonicalNameChanges(
  scenes: Array<{
    id: string;
    sceneOrder: number;
    assetSlots: Array<{ id: string; assetOrder: number; canonicalName: string }>;
  }>,
  orderedSceneIds: string[],
): CanonicalNameChange[] {
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  return orderedSceneIds.flatMap((sceneId, index) => {
    const scene = byId.get(sceneId);
    if (!scene) throw new Error(`Unknown scene: ${sceneId}`);
    return scene.assetSlots
      .map((slot) => ({
        slotId: slot.id,
        from: slot.canonicalName,
        to: canonicalAssetName(index + 1, slot.assetOrder),
      }))
      .filter((change) => change.from !== change.to);
  });
}
