import { randomUUID } from 'node:crypto';
import type { Scene, ScriptRevision } from '../../shared/domain.js';
import { DomainError } from '../../shared/errors.js';
import { planCanonicalNameChanges, type CanonicalNameChange } from '../../shared/naming.js';
import { parseScript, type ScriptImportFormat } from '../../shared/script-format.js';
import {
  sceneCreateSchema,
  sceneReorderSchema,
  sceneUpdateSchema,
  type SceneCreateInput,
  type SceneUpdateInput,
} from '../../shared/schemas.js';
import type { StudioRepository } from '../repositories/studio-repository.js';
import type { AssetService } from './asset-service.js';

export class ScriptService {
  constructor(
    private readonly repository: StudioRepository,
    private readonly assetService: AssetService,
  ) {}

  createScene(input: SceneCreateInput): Scene {
    const parsed = sceneCreateSchema.parse(input);
    const now = new Date().toISOString();
    const scene = this.repository.insertScene({
      id: randomUUID(),
      episodeId: parsed.episodeId,
      sceneOrder: this.repository.nextSceneOrder(parsed.episodeId),
      title: parsed.title,
      summary: parsed.summary,
      narration: parsed.narration,
      imagePrompt: parsed.imagePrompt,
      videoPrompt: parsed.videoPrompt,
      status: 'draft',
      revisionNo: 0,
      createdAt: now,
      updatedAt: now,
    });
    this.repository.refreshEpisodeStatus(parsed.episodeId);
    return scene;
  }

  updateScene(input: SceneUpdateInput): Scene {
    const parsed = sceneUpdateSchema.parse(input);
    const current = this.repository.getScene(parsed.id);
    const nextStatus = current.status === 'approved' ? 'needs_changes' : current.status;
    const scene = this.repository.updateScene(
      {
        ...current,
        title: parsed.title,
        summary: parsed.summary,
        narration: parsed.narration,
        imagePrompt: parsed.imagePrompt,
        videoPrompt: parsed.videoPrompt,
        status: nextStatus,
        revisionNo: current.revisionNo + 1,
        updatedAt: new Date().toISOString(),
      },
      parsed.revisionNo,
    );
    this.repository.refreshEpisodeStatus(current.episodeId);
    return scene;
  }

  deleteScene(id: string): void {
    const scene = this.repository.getScene(id);
    this.repository.deleteScene(id);
    this.repository.refreshEpisodeStatus(scene.episodeId);
  }

  previewReorder(episodeId: string, orderedSceneIds: string[]): CanonicalNameChange[] {
    const detail = this.repository.getEpisodeDetail(episodeId);
    if (
      detail.scenes.length !== orderedSceneIds.length ||
      detail.scenes.some((scene) => !orderedSceneIds.includes(scene.id))
    ) {
      throw new DomainError('VALIDATION_ERROR', 'Danh sách scene reorder không khớp Episode.');
    }
    return planCanonicalNameChanges(detail.scenes, orderedSceneIds);
  }

  reorder(input: unknown): CanonicalNameChange[] {
    const parsed = sceneReorderSchema.parse(input);
    const changes = this.previewReorder(parsed.episodeId, parsed.orderedSceneIds);
    if (changes.length > 0 && !parsed.confirmed) {
      throw new DomainError(
        'REORDER_CONFIRMATION_REQUIRED',
        'Reorder sẽ đổi canonical name; cần xác nhận preview.',
        changes.map((change) => `${change.from} → ${change.to}`),
      );
    }
    this.repository.reorderScenes(parsed.episodeId, parsed.orderedSceneIds);
    this.repository.refreshEpisodeStatus(parsed.episodeId);
    return changes;
  }

  importScript(input: {
    episodeId: string;
    format: ScriptImportFormat;
    source: string;
    replaceConfirmed?: boolean;
  }): ScriptRevision {
    const parsed = parseScript(input.source, input.format);
    const existing = this.repository.listScenes(input.episodeId);
    if (existing.length > 0 && !input.replaceConfirmed) {
      throw new DomainError(
        'CONFLICT',
        'Import sẽ thay thế scene hiện tại; cần xác nhận trước khi tiếp tục.',
      );
    }

    const now = new Date().toISOString();
    const scenes: Scene[] = parsed.scenes.map((scene, index) => ({
      id: randomUUID(),
      episodeId: input.episodeId,
      sceneOrder: index + 1,
      ...scene,
      status: 'draft',
      revisionNo: 0,
      createdAt: now,
      updatedAt: now,
    }));
    const script = this.repository.getScriptForEpisode(input.episodeId);
    const revision: ScriptRevision = {
      id: randomUUID(),
      scriptId: script.id,
      revisionNo: this.repository.nextRevisionNo(script.id),
      source: 'import',
      sourceFormat: input.format,
      rawSource: input.source,
      snapshotJson: JSON.stringify({
        schemaVersion: 1,
        title: parsed.title,
        scenes: parsed.scenes,
      }),
      templateVersionId: script.templateVersionId,
      renderedPromptSnapshot: script.renderedPromptSnapshot,
      createdAt: now,
    };
    this.repository.replaceScenes(input.episodeId, scenes, revision);
    this.repository.refreshEpisodeStatus(input.episodeId);
    return revision;
  }

  saveRevision(episodeId: string): ScriptRevision {
    const script = this.repository.getScriptForEpisode(episodeId);
    const scenes = this.repository.listScenes(episodeId).map((scene) => ({
      title: scene.title,
      summary: scene.summary,
      narration: scene.narration,
      imagePrompt: scene.imagePrompt,
      videoPrompt: scene.videoPrompt,
    }));
    if (scenes.length === 0) {
      throw new DomainError('SCENE_INVALID', 'Không thể tạo revision khi chưa có scene.');
    }
    const now = new Date().toISOString();
    return this.repository.createRevision({
      id: randomUUID(),
      scriptId: script.id,
      revisionNo: this.repository.nextRevisionNo(script.id),
      source: 'manual',
      sourceFormat: 'editor',
      rawSource: '',
      snapshotJson: JSON.stringify({ schemaVersion: 1, scenes }),
      templateVersionId: script.templateVersionId,
      renderedPromptSnapshot: script.renderedPromptSnapshot,
      createdAt: now,
    });
  }

  listRevisions(episodeId: string): ScriptRevision[] {
    return this.repository.listRevisions(episodeId);
  }

  approveScene(id: string): void {
    const scene = this.repository.getScene(id);
    const slots = this.repository.listAssetSlots(id);
    const references = this.assetService.refreshReferences(scene.episodeId);
    const referencesById = new Map(references.map((reference) => [reference.id, reference]));
    const issues: string[] = [];
    if (!scene.title.trim()) issues.push('Scene title không được để trống.');
    if (
      ![scene.summary, scene.narration, scene.imagePrompt, scene.videoPrompt].some(
        (value) => value.trim().length > 0,
      )
    ) {
      issues.push('Scene phải có ít nhất một trường nội dung.');
    }
    if (slots.length === 0) issues.push('Scene phải có ít nhất một asset slot.');
    for (const slot of slots) {
      if (!slot.prompt.trim()) issues.push(`${slot.canonicalName}: prompt không được để trống.`);
      for (const referenceId of slot.referenceIds) {
        if (referencesById.get(referenceId)?.status !== 'available') {
          issues.push(`${slot.canonicalName}: reference bị thiếu hoặc đã thay đổi.`);
        }
      }
    }
    if (issues.length > 0) {
      throw new DomainError('SCENE_INVALID', 'Scene chưa đủ điều kiện để duyệt.', issues);
    }
    this.repository.setSceneStatus(id, 'approved', new Date().toISOString());
    this.repository.refreshEpisodeStatus(scene.episodeId);
  }
}
