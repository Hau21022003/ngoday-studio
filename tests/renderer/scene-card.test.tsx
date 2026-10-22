import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StudioApi } from '../../src/shared/contracts.js';
import type { Scene } from '../../src/shared/domain.js';
import { SceneCard } from '../../src/renderer/src/components/SceneCard';
import { TooltipProvider } from '../../src/renderer/src/components/ui/tooltip';

const scene: Scene & { assetSlots: [] } = {
  id: 'f79935f2-518f-4b7b-b923-558ce6156784',
  episodeId: '10162512-2146-4b8d-970d-66e463419bc1',
  sceneOrder: 1,
  title: 'Opening',
  summary: '',
  narration: 'Narration',
  imagePrompt: '',
  videoPrompt: '',
  status: 'draft',
  revisionNo: 0,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
  assetSlots: [],
};

describe('SceneCard autosave', () => {
  it('persists an edit after the debounce interval', async () => {
    vi.useFakeTimers();
    const update = vi.fn(async (input) => ({
      ...scene,
      ...input,
      revisionNo: 1,
      updatedAt: '2026-10-23T00:01:00.000Z',
    }));
    window.studio = { scenes: { update } } as unknown as StudioApi;

    render(
      <TooltipProvider>
        <SceneCard
          scene={scene}
          references={[]}
          canMoveUp={false}
          canMoveDown={false}
          onMove={vi.fn()}
          onRefresh={vi.fn(async () => undefined)}
          onError={vi.fn()}
        />
      </TooltipProvider>,
    );
    fireEvent.change(screen.getByLabelText('Tiêu đề Scene 1'), {
      target: { value: 'Opening revised' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Opening revised', revisionNo: 0 }),
    );
    expect(screen.getByText('Đã lưu')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('requires an accessible confirmation before deleting a scene', async () => {
    const user = userEvent.setup();
    const remove = vi.fn(async () => undefined);
    const onRefresh = vi.fn(async () => undefined);
    window.studio = { scenes: { delete: remove } } as unknown as StudioApi;

    render(
      <TooltipProvider>
        <SceneCard
          scene={scene}
          references={[]}
          canMoveUp={false}
          canMoveDown={false}
          onMove={vi.fn()}
          onRefresh={onRefresh}
          onError={vi.fn()}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Xóa scene' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/asset slot bên trong scene/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Xóa scene' }));
    expect(remove).toHaveBeenCalledWith(scene.id);
    expect(onRefresh).toHaveBeenCalled();
  });
});
