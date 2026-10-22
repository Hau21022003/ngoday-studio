import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import type { AssetSlot, CharacterReference } from '../../shared/domain.js';
import { DomainError } from '../../shared/errors.js';
import { canonicalAssetName } from '../../shared/naming.js';
import {
  assetSlotCreateSchema,
  assetSlotUpdateSchema,
  type AssetSlotCreateInput,
  type AssetSlotUpdateInput,
} from '../../shared/schemas.js';
import type { StudioRepository } from '../repositories/studio-repository.js';

const supportedReferenceTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export class AssetService {
  constructor(private readonly repository: StudioRepository) {}

  create(input: AssetSlotCreateInput): AssetSlot {
    const parsed = assetSlotCreateSchema.parse(input);
    const scene = this.repository.getScene(parsed.sceneId);
    const assetOrder = this.repository.nextAssetOrder(scene.id);
    const now = new Date().toISOString();
    const slot = this.repository.insertAssetSlot({
      id: randomUUID(),
      episodeId: scene.episodeId,
      sceneId: scene.id,
      assetOrder,
      canonicalName: canonicalAssetName(scene.sceneOrder, assetOrder),
      mediaType: parsed.mediaType,
      required: parsed.required,
      prompt: parsed.prompt,
      referenceIds: [],
      createdAt: now,
      updatedAt: now,
    });
    this.invalidateApprovedScene(scene.id);
    return slot;
  }

  update(input: AssetSlotUpdateInput): AssetSlot {
    const parsed = assetSlotUpdateSchema.parse(input);
    const current = this.repository.getAssetSlot(parsed.id);
    const references = this.repository.listReferences(current.episodeId);
    const referenceIds = new Set(references.map((reference) => reference.id));
    const invalid = parsed.referenceIds.filter((id) => !referenceIds.has(id));
    if (invalid.length > 0) {
      throw new DomainError('VALIDATION_ERROR', 'Reference không thuộc Episode hiện tại.', invalid);
    }
    const updated = this.repository.updateAssetSlot({
      ...current,
      ...parsed,
      updatedAt: new Date().toISOString(),
    });
    this.invalidateApprovedScene(current.sceneId);
    return updated;
  }

  delete(id: string): void {
    const slot = this.repository.getAssetSlot(id);
    this.repository.deleteAssetSlot(id);
    this.invalidateApprovedScene(slot.sceneId);
  }

  addReference(episodeId: string, sourcePath: string): CharacterReference {
    if (!existsSync(sourcePath)) {
      throw new DomainError('VALIDATION_ERROR', 'Không tìm thấy file reference.');
    }
    const extension = extname(sourcePath).toLowerCase();
    const mimeType = supportedReferenceTypes[extension];
    if (!mimeType) {
      throw new DomainError('VALIDATION_ERROR', 'Reference phải là JPEG, PNG hoặc WebP.');
    }
    const bytes = readFileSync(sourcePath);
    const stat = statSync(sourcePath);
    const now = new Date().toISOString();
    return this.repository.insertReference({
      id: randomUUID(),
      episodeId,
      name: basename(sourcePath),
      sourcePath,
      mimeType,
      sizeBytes: stat.size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      status: 'available',
      createdAt: now,
      updatedAt: now,
    });
  }

  refreshReferences(episodeId: string): CharacterReference[] {
    const references = this.repository.listReferences(episodeId);
    const now = new Date().toISOString();
    for (const reference of references) {
      let available = false;
      if (existsSync(reference.sourcePath)) {
        const bytes = readFileSync(reference.sourcePath);
        available =
          statSync(reference.sourcePath).size === reference.sizeBytes &&
          createHash('sha256').update(bytes).digest('hex') === reference.sha256;
      }
      const nextStatus = available ? 'available' : 'missing';
      if (nextStatus !== reference.status) {
        this.repository.setReferenceStatus(reference.id, nextStatus, now);
        if (nextStatus === 'missing') {
          const detail = this.repository.getEpisodeDetail(episodeId);
          for (const scene of detail.scenes) {
            if (scene.assetSlots.some((slot) => slot.referenceIds.includes(reference.id))) {
              this.invalidateApprovedScene(scene.id);
            }
          }
        }
      }
    }
    return this.repository.listReferences(episodeId);
  }

  deleteReference(id: string): void {
    this.repository.deleteReference(id);
  }

  private invalidateApprovedScene(sceneId: string): void {
    const scene = this.repository.getScene(sceneId);
    if (scene.status === 'approved') {
      this.repository.setSceneStatus(scene.id, 'needs_changes', new Date().toISOString());
    }
    this.repository.refreshEpisodeStatus(scene.episodeId);
  }
}
