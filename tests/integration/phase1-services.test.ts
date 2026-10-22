import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type StudioDatabase } from '../../src/main/database/connection.js';
import { StudioRepository } from '../../src/main/repositories/studio-repository.js';
import { AssetService } from '../../src/main/services/asset-service.js';
import { BackupService } from '../../src/main/services/backup-service.js';
import { EpisodeService } from '../../src/main/services/episode-service.js';
import { ScriptService } from '../../src/main/services/script-service.js';
import { TemplateService } from '../../src/main/services/template-service.js';
import { DomainError } from '../../src/shared/errors.js';

describe('Phase 1 services', () => {
  let database: StudioDatabase;
  let repository: StudioRepository;
  let episodes: EpisodeService;
  let templates: TemplateService;
  let assets: AssetService;
  let scripts: ScriptService;

  beforeEach(() => {
    database = openDatabase(':memory:');
    repository = new StudioRepository(database);
    episodes = new EpisodeService(repository);
    templates = new TemplateService(repository);
    assets = new AssetService(repository);
    scripts = new ScriptService(repository, assets);
  });

  afterEach(() => database.close());

  function createEpisode() {
    return episodes.create({
      title: 'Pilot',
      topic: 'Paper boat',
      slug: 'pilot',
      notes: 'Keep it calm',
    });
  }

  it('creates, edits, searches and archives an Episode', () => {
    const episode = createEpisode();
    expect(episodes.list({ query: 'paper' })).toHaveLength(1);

    episodes.update({ ...episode, title: 'Pilot edited', status: 'draft' });
    expect(episodes.detail(episode.id).episode.title).toBe('Pilot edited');

    episodes.archive(episode.id);
    expect(episodes.list()).toEqual([]);
    expect(episodes.list({ includeArchived: true })[0].status).toBe('archived');
  });

  it('keeps old template versions and rendered snapshots immutable', () => {
    const episode = createEpisode();
    const template = templates.create({
      name: 'Script prompt',
      purpose: 'Draft',
      content: 'Write {{episode_title}} about {{topic}}. {{notes}}',
    });
    const first = template.versions[0];
    const rendered = templates.render({ templateVersionId: first.id, episodeId: episode.id });
    const second = templates.createVersion({
      templateId: template.id,
      content: 'New prompt for {{topic}}',
    });

    expect(rendered.rendered).toContain('Pilot');
    expect(repository.getTemplateVersion(first.id).content).toContain('{{episode_title}}');
    expect(second.versionNo).toBe(2);
    expect(repository.getScriptForEpisode(episode.id).renderedPromptSnapshot).toBe(
      rendered.rendered,
    );
  });

  it('imports atomically and preserves old data after invalid import', () => {
    const episode = createEpisode();
    scripts.importScript({
      episodeId: episode.id,
      format: 'json',
      source: JSON.stringify({
        schemaVersion: 1,
        scenes: [
          { title: 'One', narration: 'First' },
          { title: 'Two', imagePrompt: 'Second image' },
        ],
      }),
    });
    expect(repository.listScenes(episode.id).map((scene) => scene.sceneOrder)).toEqual([1, 2]);

    expect(() =>
      scripts.importScript({
        episodeId: episode.id,
        format: 'json',
        source: '{"schemaVersion":1,"scenes":[]}',
        replaceConfirmed: true,
      }),
    ).toThrow(DomainError);
    expect(repository.listScenes(episode.id).map((scene) => scene.title)).toEqual(['One', 'Two']);
  });

  it('requires a canonical-name preview confirmation before reorder', () => {
    const episode = createEpisode();
    const first = scripts.createScene({ episodeId: episode.id, title: 'One', narration: 'A' });
    const second = scripts.createScene({ episodeId: episode.id, title: 'Two', narration: 'B' });
    assets.create({ sceneId: first.id, mediaType: 'image', prompt: 'Prompt one', required: true });
    assets.create({ sceneId: second.id, mediaType: 'video', prompt: 'Prompt two', required: true });

    const order = [second.id, first.id];
    expect(() => scripts.reorder({ episodeId: episode.id, orderedSceneIds: order })).toThrow(
      'cần xác nhận',
    );
    const changes = scripts.reorder({
      episodeId: episode.id,
      orderedSceneIds: order,
      confirmed: true,
    });
    expect(changes).toHaveLength(2);
    expect(repository.listScenes(episode.id).map((scene) => scene.id)).toEqual(order);
    expect(repository.listAssetSlots(second.id)[0].canonicalName).toBe('scene-01-01');
  });

  it('approves only a valid scene and invalidates approval after editing', () => {
    const episode = createEpisode();
    const scene = scripts.createScene({ episodeId: episode.id, title: '', narration: '' });
    expect(() => scripts.approveScene(scene.id)).toThrow('chưa đủ điều kiện');

    const updated = scripts.updateScene({
      id: scene.id,
      revisionNo: scene.revisionNo,
      title: 'Opening',
      summary: '',
      narration: 'Start here',
      imagePrompt: '',
      videoPrompt: '',
    });
    const slot = assets.create({
      sceneId: scene.id,
      mediaType: 'image',
      prompt: 'A calm table',
      required: true,
    });
    scripts.approveScene(scene.id);
    expect(repository.getScene(scene.id).status).toBe('approved');
    expect(repository.getEpisode(episode.id).status).toBe('script_ready');

    assets.update({
      id: slot.id,
      mediaType: slot.mediaType,
      required: slot.required,
      prompt: 'A calmer table',
      referenceIds: [],
    });
    expect(repository.getScene(scene.id).status).toBe('needs_changes');
    expect(repository.getEpisode(episode.id).status).toBe('draft');
    scripts.approveScene(scene.id);

    scripts.updateScene({
      id: scene.id,
      revisionNo: updated.revisionNo,
      title: 'Opening changed',
      summary: '',
      narration: 'Start here',
      imagePrompt: '',
      videoPrompt: '',
    });
    expect(repository.getScene(scene.id).status).toBe('needs_changes');
  });

  it('creates immutable script revisions', () => {
    const episode = createEpisode();
    const scene = scripts.createScene({ episodeId: episode.id, title: 'One', narration: 'Old' });
    const first = scripts.saveRevision(episode.id);
    scripts.updateScene({
      id: scene.id,
      revisionNo: scene.revisionNo,
      title: 'One',
      summary: '',
      narration: 'New',
      imagePrompt: '',
      videoPrompt: '',
    });
    scripts.saveRevision(episode.id);

    const revisions = scripts.listRevisions(episode.id);
    expect(revisions).toHaveLength(2);
    expect(
      JSON.parse(revisions.find((revision) => revision.id === first.id)!.snapshotJson),
    ).toMatchObject({
      scenes: [{ narration: 'Old' }],
    });
  });

  it('restores a validated backup into an empty database only', () => {
    const episode = createEpisode();
    scripts.createScene({ episodeId: episode.id, title: 'One', narration: 'Text' });
    const backup = new BackupService(repository, assets).create();

    const restoredDatabase = openDatabase(':memory:');
    const restoredRepository = new StudioRepository(restoredDatabase);
    const restoredAssets = new AssetService(restoredRepository);
    const restoreService = new BackupService(restoredRepository, restoredAssets);
    restoreService.restore(JSON.stringify(backup));

    expect(restoredRepository.getEpisodeDetail(episode.id).scenes[0].title).toBe('One');
    expect(() => restoreService.restore(JSON.stringify(backup))).toThrow('database trống');
    restoredDatabase.close();
  });
});

describe('autosave persistence', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it('keeps scene edits after closing and reopening the database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ngoday-autosave-'));
    directories.push(directory);
    const filename = join(directory, 'app.db');
    const firstDb = openDatabase(filename);
    const firstRepo = new StudioRepository(firstDb);
    const episode = new EpisodeService(firstRepo).create({
      title: 'Persisted',
      topic: 'Topic',
      slug: 'persisted',
      notes: '',
    });
    const sceneService = new ScriptService(firstRepo, new AssetService(firstRepo));
    const scene = sceneService.createScene({
      episodeId: episode.id,
      title: 'Draft',
      narration: 'Old',
    });
    sceneService.updateScene({
      id: scene.id,
      revisionNo: 0,
      title: 'Saved automatically',
      summary: '',
      narration: 'New value',
      imagePrompt: '',
      videoPrompt: '',
    });
    firstDb.close();

    const reopened = openDatabase(filename);
    expect(new StudioRepository(reopened).getScene(scene.id).title).toBe('Saved automatically');
    reopened.close();
  });
});
