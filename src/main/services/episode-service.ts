import { randomUUID } from 'node:crypto';
import type { Episode, EpisodeDetail, Script } from '../../shared/domain.js';
import { DomainError } from '../../shared/errors.js';
import {
  episodeCreateSchema,
  episodeListSchema,
  episodeUpdateSchema,
  type EpisodeCreateInput,
  type EpisodeUpdateInput,
} from '../../shared/schemas.js';
import type { StudioRepository } from '../repositories/studio-repository.js';

export class EpisodeService {
  constructor(private readonly repository: StudioRepository) {}

  create(input: EpisodeCreateInput): Episode {
    const parsed = episodeCreateSchema.parse(input);
    const now = new Date().toISOString();
    const episode: Episode = {
      id: randomUUID(),
      ...parsed,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    const script: Script = {
      id: randomUUID(),
      episodeId: episode.id,
      currentRevisionId: null,
      templateVersionId: null,
      renderedPromptSnapshot: null,
      createdAt: now,
      updatedAt: now,
    };
    try {
      return this.repository.createEpisode(episode, script);
    } catch (error) {
      if (String(error).includes('UNIQUE constraint failed: episodes.slug')) {
        throw new DomainError('DUPLICATE_SLUG', 'Slug Episode đã tồn tại.');
      }
      throw error;
    }
  }

  update(input: EpisodeUpdateInput): Episode {
    const parsed = episodeUpdateSchema.parse(input);
    const current = this.repository.getEpisode(parsed.id);
    return this.repository.updateEpisode({
      ...current,
      ...parsed,
      updatedAt: new Date().toISOString(),
    });
  }

  archive(id: string): Episode {
    const current = this.repository.getEpisode(id);
    return this.repository.updateEpisode({
      ...current,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    });
  }

  list(input: { query?: string; includeArchived?: boolean } = {}): Episode[] {
    const parsed = episodeListSchema.parse(input);
    return this.repository.listEpisodes(parsed.query, parsed.includeArchived);
  }

  detail(id: string): EpisodeDetail {
    return this.repository.getEpisodeDetail(id);
  }
}
