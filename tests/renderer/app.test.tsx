import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StudioApi } from '../../src/shared/contracts.js';
import type { Episode, EpisodeDetail } from '../../src/shared/domain.js';
import { App } from '../../src/renderer/src/App';

const episode: Episode = {
  id: '10162512-2146-4b8d-970d-66e463419bc1',
  title: 'Paper Boat Pilot',
  topic: 'Origami',
  slug: 'paper-boat-pilot',
  notes: '',
  status: 'draft',
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
};

const detail: EpisodeDetail = {
  episode,
  script: {
    id: '571698da-8dbb-4f03-8282-d2c845c3395f',
    episodeId: episode.id,
    currentRevisionId: null,
    templateVersionId: null,
    renderedPromptSnapshot: null,
    createdAt: episode.createdAt,
    updatedAt: episode.updatedAt,
  },
  scenes: [],
  references: [],
};

function createApi(): StudioApi {
  return {
    episodes: {
      list: vi.fn(async () => [episode]),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      detail: vi.fn(async () => detail),
    },
    templates: {
      list: vi.fn(async () => []),
      create: vi.fn(),
      createVersion: vi.fn(),
      render: vi.fn(),
    },
    scenes: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      previewReorder: vi.fn(),
      reorder: vi.fn(),
      import: vi.fn(),
      approve: vi.fn(),
      saveRevision: vi.fn(),
      listRevisions: vi.fn(async () => []),
    },
    assets: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addReference: vi.fn(),
      refreshReferences: vi.fn(),
      deleteReference: vi.fn(),
    },
    backup: { export: vi.fn(), restore: vi.fn() },
  };
}

describe('App', () => {
  it('loads the Episode library and opens the first Episode', async () => {
    window.studio = createApi();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Paper Boat Pilot' })).toBeInTheDocument();
    expect(screen.getAllByText('Origami')).toHaveLength(2);
    expect(screen.getByText(/Không kết nối Google Flow/)).toBeInTheDocument();
    expect(window.studio.episodes.detail).toHaveBeenCalledWith(episode.id);
  });

  it('switches workspaces through accessible tabs', async () => {
    const user = userEvent.setup();
    window.studio = createApi();
    render(<App />);

    await screen.findByRole('heading', { name: 'Paper Boat Pilot' });
    const templateTab = screen.getByRole('tab', { name: 'Prompt Templates' });
    await user.click(templateTab);

    expect(templateTab).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: 'Template versions' })).toBeInTheDocument();
  });

  it('shows accessible field errors before creating an invalid Episode', async () => {
    const user = userEvent.setup();
    window.studio = createApi();
    render(<App />);

    await screen.findByRole('heading', { name: 'Paper Boat Pilot' });
    await user.click(screen.getByRole('button', { name: /Mới/ }));
    await user.click(screen.getByRole('button', { name: 'Tạo Episode' }));

    expect((await screen.findAllByRole('alert')).length).toBeGreaterThanOrEqual(3);
    expect(window.studio.episodes.create).not.toHaveBeenCalled();
  });
});
