import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/main/database/connection.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('database migrations', () => {
  it('creates the Phase 1 schema and can reopen the same database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ngoday-db-'));
    temporaryDirectories.push(directory);
    const filename = join(directory, 'app.db');

    const first = openDatabase(filename);
    first
      .prepare(
        `INSERT INTO episodes
          (id, title, topic, slug, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('episode-1', 'Pilot', 'Paper boats', 'pilot', '', 'draft', 'now', 'now');
    first.close();

    const reopened = openDatabase(filename);
    const episode = reopened
      .prepare('SELECT title FROM episodes WHERE id = ?')
      .get('episode-1') as {
      title: string;
    };
    const migrations = reopened.prepare('SELECT version FROM schema_migrations').all();
    reopened.close();

    expect(episode.title).toBe('Pilot');
    expect(migrations).toEqual([{ version: 1 }]);
  });

  it('enforces canonical-name uniqueness inside an episode', () => {
    const database = openDatabase(':memory:');
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO episodes
          (id, title, topic, slug, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('episode-1', 'Pilot', 'Topic', 'pilot', '', 'draft', now, now);
    database
      .prepare(
        `INSERT INTO scenes
          (id, episode_id, scene_order, title, summary, narration, image_prompt, video_prompt, status, revision_no, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', '', '', '', 'draft', 0, ?, ?)`,
      )
      .run('scene-1', 'episode-1', 1, 'One', now, now);

    const insert = database.prepare(
      `INSERT INTO asset_slots
        (id, episode_id, scene_id, asset_order, canonical_name, media_type, required, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'image', 1, '', ?, ?)`,
    );
    insert.run('slot-1', 'episode-1', 'scene-1', 1, 'scene-01-01', now, now);

    expect(() =>
      insert.run('slot-2', 'episode-1', 'scene-1', 2, 'scene-01-01', now, now),
    ).toThrow();
    database.close();
  });
});
