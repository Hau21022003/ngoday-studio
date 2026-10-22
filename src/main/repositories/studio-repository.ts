import type {
  AssetSlot,
  CharacterReference,
  Episode,
  EpisodeDetail,
  PromptTemplate,
  PromptTemplateVersion,
  Scene,
  Script,
  ScriptRevision,
  TemplateDetail,
} from '../../shared/domain.js';
import { DomainError } from '../../shared/errors.js';
import { canonicalAssetName } from '../../shared/naming.js';
import type { StudioDatabase } from '../database/connection.js';
import { inTransaction } from '../database/transaction.js';

type Row = Record<string, unknown>;

export class StudioRepository {
  constructor(private readonly database: StudioDatabase) {}

  createEpisode(episode: Episode, script: Script): Episode {
    inTransaction(this.database, () => {
      this.database
        .prepare(
          `INSERT INTO episodes
            (id, title, topic, slug, notes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          episode.id,
          episode.title,
          episode.topic,
          episode.slug,
          episode.notes,
          episode.status,
          episode.createdAt,
          episode.updatedAt,
        );
      this.database
        .prepare(
          `INSERT INTO scripts
            (id, episode_id, current_revision_id, template_version_id, rendered_prompt_snapshot, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, NULL, ?, ?)`,
        )
        .run(script.id, episode.id, script.createdAt, script.updatedAt);
    });
    return episode;
  }

  listEpisodes(query = '', includeArchived = false): Episode[] {
    const like = `%${query.trim()}%`;
    const rows = this.database
      .prepare(
        `SELECT * FROM episodes
         WHERE (? = 1 OR status <> 'archived')
           AND (? = '' OR title LIKE ? COLLATE NOCASE OR topic LIKE ? COLLATE NOCASE OR slug LIKE ? COLLATE NOCASE)
         ORDER BY updated_at DESC`,
      )
      .all(includeArchived ? 1 : 0, query.trim(), like, like, like) as Row[];
    return rows.map(mapEpisode);
  }

  getEpisode(id: string): Episode {
    const row = this.database.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as
      Row | undefined;
    if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy Episode.');
    return mapEpisode(row);
  }

  updateEpisode(episode: Episode): Episode {
    try {
      const result = this.database
        .prepare(
          `UPDATE episodes
           SET title = ?, topic = ?, slug = ?, notes = ?, status = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          episode.title,
          episode.topic,
          episode.slug,
          episode.notes,
          episode.status,
          episode.updatedAt,
          episode.id,
        );
      if (Number(result.changes) !== 1)
        throw new DomainError('NOT_FOUND', 'Không tìm thấy Episode.');
      return episode;
    } catch (error) {
      if (String(error).includes('UNIQUE constraint failed: episodes.slug')) {
        throw new DomainError('DUPLICATE_SLUG', 'Slug Episode đã tồn tại.');
      }
      throw error;
    }
  }

  getEpisodeDetail(id: string): EpisodeDetail {
    const episode = this.getEpisode(id);
    const scriptRow = this.database
      .prepare('SELECT * FROM scripts WHERE episode_id = ?')
      .get(id) as Row;
    return {
      episode,
      script: mapScript(scriptRow),
      scenes: this.listScenes(id).map((scene) => ({
        ...scene,
        assetSlots: this.listAssetSlots(scene.id),
      })),
      references: this.listReferences(id),
    };
  }

  refreshEpisodeStatus(episodeId: string): Episode['status'] {
    const episode = this.getEpisode(episodeId);
    if (episode.status === 'archived') return 'archived';
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
         FROM scenes WHERE episode_id = ?`,
      )
      .get(episodeId) as Row;
    const total = Number(row.total);
    const approved = Number(row.approved ?? 0);
    const status: Episode['status'] = total > 0 && total === approved ? 'script_ready' : 'draft';
    if (status !== episode.status) {
      this.database
        .prepare('UPDATE episodes SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, new Date().toISOString(), episodeId);
    }
    return status;
  }

  createTemplate(template: PromptTemplate, version: PromptTemplateVersion): TemplateDetail {
    inTransaction(this.database, () => {
      this.database
        .prepare(
          `INSERT INTO prompt_templates
            (id, name, purpose, current_version_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          template.id,
          template.name,
          template.purpose,
          version.id,
          template.createdAt,
          template.updatedAt,
        );
      this.insertTemplateVersion(version);
    });
    return { ...template, currentVersionId: version.id, versions: [version] };
  }

  addTemplateVersion(version: PromptTemplateVersion): PromptTemplateVersion {
    inTransaction(this.database, () => {
      this.insertTemplateVersion(version);
      const result = this.database
        .prepare('UPDATE prompt_templates SET current_version_id = ?, updated_at = ? WHERE id = ?')
        .run(version.id, version.createdAt, version.templateId);
      if (Number(result.changes) !== 1)
        throw new DomainError('NOT_FOUND', 'Không tìm thấy template.');
    });
    return version;
  }

  private insertTemplateVersion(version: PromptTemplateVersion): void {
    this.database
      .prepare(
        `INSERT INTO prompt_template_versions
          (id, template_id, version_no, content, allowed_variables_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        version.id,
        version.templateId,
        version.versionNo,
        version.content,
        JSON.stringify(version.allowedVariables),
        version.createdAt,
      );
  }

  nextTemplateVersionNo(templateId: string): number {
    const row = this.database
      .prepare(
        'SELECT COALESCE(MAX(version_no), 0) + 1 AS next_no FROM prompt_template_versions WHERE template_id = ?',
      )
      .get(templateId) as Row;
    return Number(row.next_no);
  }

  listTemplates(): TemplateDetail[] {
    const templates = this.database
      .prepare('SELECT * FROM prompt_templates ORDER BY updated_at DESC')
      .all() as Row[];
    return templates.map((row) => {
      const template = mapTemplate(row);
      const versions = this.database
        .prepare(
          'SELECT * FROM prompt_template_versions WHERE template_id = ? ORDER BY version_no DESC',
        )
        .all(template.id) as Row[];
      return { ...template, versions: versions.map(mapTemplateVersion) };
    });
  }

  getTemplateVersion(id: string): PromptTemplateVersion {
    const row = this.database
      .prepare('SELECT * FROM prompt_template_versions WHERE id = ?')
      .get(id) as Row | undefined;
    if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy phiên bản template.');
    return mapTemplateVersion(row);
  }

  saveRenderedPrompt(
    episodeId: string,
    templateVersionId: string,
    renderedPrompt: string,
    updatedAt: string,
  ): void {
    const result = this.database
      .prepare(
        `UPDATE scripts
         SET template_version_id = ?, rendered_prompt_snapshot = ?, updated_at = ?
         WHERE episode_id = ?`,
      )
      .run(templateVersionId, renderedPrompt, updatedAt, episodeId);
    if (Number(result.changes) !== 1) throw new DomainError('NOT_FOUND', 'Không tìm thấy script.');
  }

  listScenes(episodeId: string): Scene[] {
    const rows = this.database
      .prepare('SELECT * FROM scenes WHERE episode_id = ? ORDER BY scene_order')
      .all(episodeId) as Row[];
    return rows.map(mapScene);
  }

  getScene(id: string): Scene {
    const row = this.database.prepare('SELECT * FROM scenes WHERE id = ?').get(id) as
      Row | undefined;
    if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy scene.');
    return mapScene(row);
  }

  nextSceneOrder(episodeId: string): number {
    const row = this.database
      .prepare(
        'SELECT COALESCE(MAX(scene_order), 0) + 1 AS next_no FROM scenes WHERE episode_id = ?',
      )
      .get(episodeId) as Row;
    return Number(row.next_no);
  }

  insertScene(scene: Scene): Scene {
    this.database
      .prepare(
        `INSERT INTO scenes
          (id, episode_id, scene_order, title, summary, narration, image_prompt, video_prompt, status, revision_no, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        scene.id,
        scene.episodeId,
        scene.sceneOrder,
        scene.title,
        scene.summary,
        scene.narration,
        scene.imagePrompt,
        scene.videoPrompt,
        scene.status,
        scene.revisionNo,
        scene.createdAt,
        scene.updatedAt,
      );
    return scene;
  }

  updateScene(scene: Scene, expectedRevisionNo: number): Scene {
    const result = this.database
      .prepare(
        `UPDATE scenes SET
          title = ?, summary = ?, narration = ?, image_prompt = ?, video_prompt = ?,
          status = ?, revision_no = ?, updated_at = ?
         WHERE id = ? AND revision_no = ?`,
      )
      .run(
        scene.title,
        scene.summary,
        scene.narration,
        scene.imagePrompt,
        scene.videoPrompt,
        scene.status,
        scene.revisionNo,
        scene.updatedAt,
        scene.id,
        expectedRevisionNo,
      );
    if (Number(result.changes) !== 1) {
      throw new DomainError('CONFLICT', 'Scene đã được thay đổi ở nơi khác. Hãy tải lại dữ liệu.');
    }
    return scene;
  }

  setSceneStatus(id: string, status: Scene['status'], updatedAt: string): void {
    const result = this.database
      .prepare('UPDATE scenes SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, updatedAt, id);
    if (Number(result.changes) !== 1) throw new DomainError('NOT_FOUND', 'Không tìm thấy scene.');
  }

  deleteScene(id: string): void {
    const scene = this.getScene(id);
    inTransaction(this.database, () => {
      this.database.prepare('DELETE FROM scenes WHERE id = ?').run(id);
      this.renumberScenes(scene.episodeId);
    });
  }

  reorderScenes(episodeId: string, orderedSceneIds: string[]): void {
    inTransaction(this.database, () => {
      const current = this.listScenes(episodeId);
      if (
        current.length !== orderedSceneIds.length ||
        current.some((scene) => !orderedSceneIds.includes(scene.id))
      ) {
        throw new DomainError('VALIDATION_ERROR', 'Danh sách scene reorder không khớp Episode.');
      }

      this.database
        .prepare('UPDATE scenes SET scene_order = scene_order + 1000000 WHERE episode_id = ?')
        .run(episodeId);
      this.database
        .prepare("UPDATE asset_slots SET canonical_name = '__reorder__' || id WHERE episode_id = ?")
        .run(episodeId);

      orderedSceneIds.forEach((sceneId, index) => {
        this.database
          .prepare('UPDATE scenes SET scene_order = ?, updated_at = ? WHERE id = ?')
          .run(index + 1, new Date().toISOString(), sceneId);
        const slots = this.listAssetSlots(sceneId);
        for (const slot of slots) {
          this.database
            .prepare('UPDATE asset_slots SET canonical_name = ?, updated_at = ? WHERE id = ?')
            .run(canonicalAssetName(index + 1, slot.assetOrder), new Date().toISOString(), slot.id);
        }
      });
    });
  }

  private renumberScenes(episodeId: string): void {
    const ids = this.listScenes(episodeId).map((scene) => scene.id);
    if (ids.length === 0) return;
    this.reorderScenesWithoutTransaction(episodeId, ids);
  }

  private reorderScenesWithoutTransaction(episodeId: string, ids: string[]): void {
    this.database
      .prepare('UPDATE scenes SET scene_order = scene_order + 1000000 WHERE episode_id = ?')
      .run(episodeId);
    this.database
      .prepare("UPDATE asset_slots SET canonical_name = '__reorder__' || id WHERE episode_id = ?")
      .run(episodeId);
    ids.forEach((id, index) => {
      this.database.prepare('UPDATE scenes SET scene_order = ? WHERE id = ?').run(index + 1, id);
      for (const slot of this.listAssetSlots(id)) {
        this.database
          .prepare('UPDATE asset_slots SET canonical_name = ? WHERE id = ?')
          .run(canonicalAssetName(index + 1, slot.assetOrder), slot.id);
      }
    });
  }

  replaceScenes(episodeId: string, scenes: Scene[], revision: ScriptRevision): void {
    inTransaction(this.database, () => {
      this.database.prepare('DELETE FROM scenes WHERE episode_id = ?').run(episodeId);
      for (const scene of scenes) this.insertScene(scene);
      this.insertRevision(revision);
      this.database
        .prepare('UPDATE scripts SET current_revision_id = ?, updated_at = ? WHERE episode_id = ?')
        .run(revision.id, revision.createdAt, episodeId);
    });
  }

  listAssetSlots(sceneId: string): AssetSlot[] {
    const rows = this.database
      .prepare('SELECT * FROM asset_slots WHERE scene_id = ? ORDER BY asset_order')
      .all(sceneId) as Row[];
    return rows.map((row) => this.mapAssetSlot(row));
  }

  getAssetSlot(id: string): AssetSlot {
    const row = this.database.prepare('SELECT * FROM asset_slots WHERE id = ?').get(id) as
      Row | undefined;
    if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy asset slot.');
    return this.mapAssetSlot(row);
  }

  nextAssetOrder(sceneId: string): number {
    const row = this.database
      .prepare(
        'SELECT COALESCE(MAX(asset_order), 0) + 1 AS next_no FROM asset_slots WHERE scene_id = ?',
      )
      .get(sceneId) as Row;
    return Number(row.next_no);
  }

  insertAssetSlot(slot: AssetSlot): AssetSlot {
    this.database
      .prepare(
        `INSERT INTO asset_slots
          (id, episode_id, scene_id, asset_order, canonical_name, media_type, required, prompt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slot.id,
        slot.episodeId,
        slot.sceneId,
        slot.assetOrder,
        slot.canonicalName,
        slot.mediaType,
        slot.required ? 1 : 0,
        slot.prompt,
        slot.createdAt,
        slot.updatedAt,
      );
    return slot;
  }

  updateAssetSlot(slot: AssetSlot): AssetSlot {
    inTransaction(this.database, () => {
      const result = this.database
        .prepare(
          `UPDATE asset_slots SET media_type = ?, required = ?, prompt = ?, updated_at = ? WHERE id = ?`,
        )
        .run(slot.mediaType, slot.required ? 1 : 0, slot.prompt, slot.updatedAt, slot.id);
      if (Number(result.changes) !== 1)
        throw new DomainError('NOT_FOUND', 'Không tìm thấy asset slot.');
      this.database
        .prepare('DELETE FROM asset_slot_references WHERE asset_slot_id = ?')
        .run(slot.id);
      slot.referenceIds.forEach((referenceId, position) => {
        this.database
          .prepare(
            'INSERT INTO asset_slot_references (asset_slot_id, reference_id, position) VALUES (?, ?, ?)',
          )
          .run(slot.id, referenceId, position);
      });
    });
    return slot;
  }

  deleteAssetSlot(id: string): void {
    const slot = this.getAssetSlot(id);
    inTransaction(this.database, () => {
      this.database.prepare('DELETE FROM asset_slots WHERE id = ?').run(id);
      const remaining = this.listAssetSlots(slot.sceneId);
      this.database
        .prepare(
          "UPDATE asset_slots SET canonical_name = '__asset_reorder__' || id WHERE scene_id = ?",
        )
        .run(slot.sceneId);
      remaining.forEach((entry, index) => {
        this.database
          .prepare(
            'UPDATE asset_slots SET asset_order = ?, canonical_name = ?, updated_at = ? WHERE id = ?',
          )
          .run(
            index + 1,
            canonicalAssetName(this.getScene(slot.sceneId).sceneOrder, index + 1),
            new Date().toISOString(),
            entry.id,
          );
      });
    });
  }

  private mapAssetSlot(row: Row): AssetSlot {
    const references = this.database
      .prepare(
        'SELECT reference_id FROM asset_slot_references WHERE asset_slot_id = ? ORDER BY position',
      )
      .all(String(row.id)) as Row[];
    return {
      id: String(row.id),
      episodeId: String(row.episode_id),
      sceneId: String(row.scene_id),
      assetOrder: Number(row.asset_order),
      canonicalName: String(row.canonical_name),
      mediaType: row.media_type as AssetSlot['mediaType'],
      required: Number(row.required) === 1,
      prompt: String(row.prompt),
      referenceIds: references.map((reference) => String(reference.reference_id)),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  insertReference(reference: CharacterReference): CharacterReference {
    this.database
      .prepare(
        `INSERT INTO character_references
          (id, episode_id, name, source_path, mime_type, size_bytes, sha256, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        reference.id,
        reference.episodeId,
        reference.name,
        reference.sourcePath,
        reference.mimeType,
        reference.sizeBytes,
        reference.sha256,
        reference.status,
        reference.createdAt,
        reference.updatedAt,
      );
    return reference;
  }

  listReferences(episodeId: string): CharacterReference[] {
    const rows = this.database
      .prepare(
        'SELECT * FROM character_references WHERE episode_id = ? ORDER BY name COLLATE NOCASE',
      )
      .all(episodeId) as Row[];
    return rows.map(mapReference);
  }

  setReferenceStatus(id: string, status: CharacterReference['status'], updatedAt: string): void {
    this.database
      .prepare('UPDATE character_references SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, updatedAt, id);
  }

  deleteReference(id: string): void {
    try {
      this.database.prepare('DELETE FROM character_references WHERE id = ?').run(id);
    } catch (error) {
      if (String(error).includes('FOREIGN KEY constraint failed')) {
        throw new DomainError('CONFLICT', 'Reference đang được một asset slot sử dụng.');
      }
      throw error;
    }
  }

  getScriptForEpisode(episodeId: string): Script {
    const row = this.database
      .prepare('SELECT * FROM scripts WHERE episode_id = ?')
      .get(episodeId) as Row | undefined;
    if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy script.');
    return mapScript(row);
  }

  nextRevisionNo(scriptId: string): number {
    const row = this.database
      .prepare(
        'SELECT COALESCE(MAX(revision_no), 0) + 1 AS next_no FROM script_revisions WHERE script_id = ?',
      )
      .get(scriptId) as Row;
    return Number(row.next_no);
  }

  createRevision(revision: ScriptRevision): ScriptRevision {
    inTransaction(this.database, () => {
      this.insertRevision(revision);
      this.database
        .prepare('UPDATE scripts SET current_revision_id = ?, updated_at = ? WHERE id = ?')
        .run(revision.id, revision.createdAt, revision.scriptId);
    });
    return revision;
  }

  private insertRevision(revision: ScriptRevision): void {
    this.database
      .prepare(
        `INSERT INTO script_revisions
          (id, script_id, revision_no, source, source_format, raw_source, snapshot_json, template_version_id, rendered_prompt_snapshot, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        revision.id,
        revision.scriptId,
        revision.revisionNo,
        revision.source,
        revision.sourceFormat,
        revision.rawSource,
        revision.snapshotJson,
        revision.templateVersionId,
        revision.renderedPromptSnapshot,
        revision.createdAt,
      );
  }

  listRevisions(episodeId: string): ScriptRevision[] {
    const rows = this.database
      .prepare(
        `SELECT revision.* FROM script_revisions revision
         JOIN scripts script ON script.id = revision.script_id
         WHERE script.episode_id = ? ORDER BY revision.revision_no DESC`,
      )
      .all(episodeId) as Row[];
    return rows.map(mapRevision);
  }

  phase1TableCounts(): Record<string, number> {
    return Object.fromEntries(
      phase1Tables.map((table) => {
        const row = this.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as Row;
        return [table, Number(row.count)];
      }),
    );
  }

  exportTableRows(): Record<string, Row[]> {
    return Object.fromEntries(
      phase1Tables.map((table) => [
        table,
        this.database.prepare(`SELECT * FROM ${table}`).all() as Row[],
      ]),
    );
  }

  restoreTableRows(tables: Record<string, Row[]>): void {
    inTransaction(this.database, () => {
      for (const table of phase1Tables) {
        const rows = tables[table] ?? [];
        for (const row of rows) {
          const columns = Object.keys(row);
          const placeholders = columns.map(() => '?').join(', ');
          this.database
            .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
            .run(...columns.map((column) => row[column] as string | number | null));
        }
      }
    });
  }
}

export const phase1Tables = [
  'episodes',
  'prompt_templates',
  'prompt_template_versions',
  'scripts',
  'script_revisions',
  'scenes',
  'character_references',
  'asset_slots',
  'asset_slot_references',
] as const;

function mapEpisode(row: Row): Episode {
  return {
    id: String(row.id),
    title: String(row.title),
    topic: String(row.topic),
    slug: String(row.slug),
    notes: String(row.notes),
    status: row.status as Episode['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapTemplate(row: Row): PromptTemplate {
  return {
    id: String(row.id),
    name: String(row.name),
    purpose: String(row.purpose),
    currentVersionId: row.current_version_id ? String(row.current_version_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapTemplateVersion(row: Row): PromptTemplateVersion {
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    versionNo: Number(row.version_no),
    content: String(row.content),
    allowedVariables: JSON.parse(String(row.allowed_variables_json)) as string[],
    createdAt: String(row.created_at),
  };
}

function mapScript(row: Row): Script {
  return {
    id: String(row.id),
    episodeId: String(row.episode_id),
    currentRevisionId: row.current_revision_id ? String(row.current_revision_id) : null,
    templateVersionId: row.template_version_id ? String(row.template_version_id) : null,
    renderedPromptSnapshot: row.rendered_prompt_snapshot
      ? String(row.rendered_prompt_snapshot)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapScene(row: Row): Scene {
  return {
    id: String(row.id),
    episodeId: String(row.episode_id),
    sceneOrder: Number(row.scene_order),
    title: String(row.title),
    summary: String(row.summary),
    narration: String(row.narration),
    imagePrompt: String(row.image_prompt),
    videoPrompt: String(row.video_prompt),
    status: row.status as Scene['status'],
    revisionNo: Number(row.revision_no),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapReference(row: Row): CharacterReference {
  return {
    id: String(row.id),
    episodeId: String(row.episode_id),
    name: String(row.name),
    sourcePath: String(row.source_path),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    status: row.status as CharacterReference['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRevision(row: Row): ScriptRevision {
  return {
    id: String(row.id),
    scriptId: String(row.script_id),
    revisionNo: Number(row.revision_no),
    source: row.source as ScriptRevision['source'],
    sourceFormat: row.source_format as ScriptRevision['sourceFormat'],
    rawSource: String(row.raw_source),
    snapshotJson: String(row.snapshot_json),
    templateVersionId: row.template_version_id ? String(row.template_version_id) : null,
    renderedPromptSnapshot: row.rendered_prompt_snapshot
      ? String(row.rendered_prompt_snapshot)
      : null,
    createdAt: String(row.created_at),
  };
}
