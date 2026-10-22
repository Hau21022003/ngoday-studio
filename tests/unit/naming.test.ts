import { describe, expect, it } from 'vitest';
import { canonicalAssetName, planCanonicalNameChanges } from '../../src/shared/naming.js';

describe('canonical asset naming', () => {
  it('uses scene and asset order with a minimum width of two', () => {
    expect(canonicalAssetName(1, 2)).toBe('scene-01-02');
    expect(canonicalAssetName(123, 4)).toBe('scene-123-04');
  });

  it('rejects invalid order values', () => {
    expect(() => canonicalAssetName(0, 1)).toThrow();
    expect(() => canonicalAssetName(1, 1.2)).toThrow();
  });

  it('previews every canonical name affected by a reorder', () => {
    const changes = planCanonicalNameChanges(
      [
        {
          id: 'a',
          sceneOrder: 1,
          assetSlots: [{ id: 'slot-a', assetOrder: 1, canonicalName: 'scene-01-01' }],
        },
        {
          id: 'b',
          sceneOrder: 2,
          assetSlots: [{ id: 'slot-b', assetOrder: 1, canonicalName: 'scene-02-01' }],
        },
      ],
      ['b', 'a'],
    );

    expect(changes).toEqual([
      { slotId: 'slot-b', from: 'scene-02-01', to: 'scene-01-01' },
      { slotId: 'slot-a', from: 'scene-01-01', to: 'scene-02-01' },
    ]);
  });
});
