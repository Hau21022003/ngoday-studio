import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { backupEnvelopeSchema, type BackupEnvelope } from '../../shared/backup-format.js';
import { DomainError } from '../../shared/errors.js';
import type { StudioRepository } from '../repositories/studio-repository.js';
import type { AssetService } from './asset-service.js';

export class BackupService {
  constructor(
    private readonly repository: StudioRepository,
    private readonly assetService: AssetService,
  ) {}

  create(): BackupEnvelope {
    return backupEnvelopeSchema.parse({
      format: 'ngoday-backup',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tables: this.repository.exportTableRows(),
    });
  }

  writeToFile(destination: string): void {
    if (existsSync(destination)) {
      throw new DomainError('CONFLICT', 'File backup đã tồn tại; hãy chọn tên mới.');
    }
    const temporary = `${destination}.part`;
    writeFileSync(temporary, `${JSON.stringify(this.create(), null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    renameSync(temporary, destination);
  }

  restore(raw: string): BackupEnvelope {
    let candidate: unknown;
    try {
      candidate = JSON.parse(raw);
    } catch {
      throw new DomainError('IMPORT_INVALID', 'File backup không phải JSON hợp lệ.');
    }
    const backup = backupEnvelopeSchema.parse(candidate);
    const counts = this.repository.phase1TableCounts();
    if (Object.values(counts).some((count) => count > 0)) {
      throw new DomainError(
        'RESTORE_REQUIRES_EMPTY_DATABASE',
        'Chỉ có thể restore vào database trống.',
      );
    }
    this.repository.restoreTableRows(backup.tables);
    for (const episode of backup.tables.episodes) {
      this.assetService.refreshReferences(episode.id);
    }
    return backup;
  }
}
