import { readFileSync } from 'node:fs';
import { dialog, ipcMain } from 'electron';
import { ZodError, type z } from 'zod';
import {
  ipcSchemas,
  type IpcChannel,
  type RpcResult,
  type StudioApiErrorShape,
} from '../../shared/contracts.js';
import { DomainError } from '../../shared/errors.js';
import type { AssetService } from '../services/asset-service.js';
import type { BackupService } from '../services/backup-service.js';
import type { EpisodeService } from '../services/episode-service.js';
import type { ScriptService } from '../services/script-service.js';
import type { TemplateService } from '../services/template-service.js';

interface Services {
  episodes: EpisodeService;
  templates: TemplateService;
  scripts: ScriptService;
  assets: AssetService;
  backup: BackupService;
}

export function registerIpcHandlers(services: Services): void {
  handle('episodes:list', (input) => services.episodes.list(input));
  handle('episodes:create', (input) => services.episodes.create(input));
  handle('episodes:update', (input) => services.episodes.update(input));
  handle('episodes:archive', (input) => services.episodes.archive(input.id));
  handle('episodes:detail', (input) => services.episodes.detail(input.id));

  handle('templates:list', () => services.templates.list());
  handle('templates:create', (input) => services.templates.create(input));
  handle('templates:create-version', (input) => services.templates.createVersion(input));
  handle('templates:render', (input) => services.templates.render(input));

  handle('scenes:create', (input) => services.scripts.createScene(input));
  handle('scenes:update', (input) => services.scripts.updateScene(input));
  handle('scenes:delete', (input) => {
    services.scripts.deleteScene(input.id);
    return null;
  });
  handle('scenes:preview-reorder', (input) =>
    services.scripts.previewReorder(input.episodeId, input.orderedSceneIds),
  );
  handle('scenes:reorder', (input) => services.scripts.reorder(input));
  handle('scenes:import', (input) => services.scripts.importScript(input));
  handle('scenes:approve', (input) => {
    services.scripts.approveScene(input.id);
    return null;
  });
  handle('scenes:save-revision', (input) => services.scripts.saveRevision(input.id));
  handle('scenes:list-revisions', (input) => services.scripts.listRevisions(input.id));

  handle('assets:create', (input) => services.assets.create(input));
  handle('assets:update', (input) => services.assets.update(input));
  handle('assets:delete', (input) => {
    services.assets.delete(input.id);
    return null;
  });
  handle('references:add', async (input) => {
    const selection = await dialog.showOpenDialog({
      title: 'Chọn character reference',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    return services.assets.addReference(input.id, selection.filePaths[0]);
  });
  handle('references:refresh', (input) => services.assets.refreshReferences(input.id));
  handle('references:delete', (input) => {
    services.assets.deleteReference(input.id);
    return null;
  });

  handle('backup:export', async () => {
    const selection = await dialog.showSaveDialog({
      title: 'Xuất metadata backup',
      defaultPath: `ngoday-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (selection.canceled || !selection.filePath) return { completed: false };
    services.backup.writeToFile(selection.filePath);
    return { completed: true, path: selection.filePath };
  });
  handle('backup:restore', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Restore metadata backup vào database trống',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return { completed: false };
    services.backup.restore(readFileSync(selection.filePaths[0], 'utf8'));
    return { completed: true, path: selection.filePaths[0] };
  });
}

function handle<C extends IpcChannel>(
  channel: C,
  action: (input: z.output<(typeof ipcSchemas)[C][0]>) => unknown | Promise<unknown>,
): void {
  const [inputSchema, outputSchema] = ipcSchemas[channel];
  ipcMain.handle(channel, async (_event, rawInput): Promise<RpcResult<unknown>> => {
    try {
      const input = inputSchema.parse(rawInput);
      const output = await action(input as never);
      return { ok: true, data: outputSchema.parse(output) };
    } catch (error) {
      return { ok: false, error: serializeError(error) };
    }
  });
}

function serializeError(error: unknown): StudioApiErrorShape {
  if (error instanceof DomainError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.',
    details: [],
  };
}
