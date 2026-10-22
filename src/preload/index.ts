import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, RpcResult, StudioApi, StudioApiErrorShape } from '../shared/contracts.js';

export class StudioApiError extends Error {
  readonly code: string;
  readonly details: string[];

  constructor(error: StudioApiErrorShape) {
    super(error.message);
    this.name = 'StudioApiError';
    this.code = error.code;
    this.details = error.details;
  }
}

async function invoke<T>(channel: IpcChannel, input: unknown = null): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, input)) as RpcResult<T>;
  if (!result.ok) throw new StudioApiError(result.error);
  return result.data;
}

const api: StudioApi = {
  episodes: {
    list: (input = {}) => invoke('episodes:list', input),
    create: (input) => invoke('episodes:create', input),
    update: (input) => invoke('episodes:update', input),
    archive: (id) => invoke('episodes:archive', { id }),
    detail: (id) => invoke('episodes:detail', { id }),
  },
  templates: {
    list: () => invoke('templates:list'),
    create: (input) => invoke('templates:create', input),
    createVersion: (input) => invoke('templates:create-version', input),
    render: (input) => invoke('templates:render', input),
  },
  scenes: {
    create: (input) => invoke('scenes:create', input),
    update: (input) => invoke('scenes:update', input),
    delete: async (id) => void (await invoke('scenes:delete', { id })),
    previewReorder: (input) => invoke('scenes:preview-reorder', input),
    reorder: (input) => invoke('scenes:reorder', input),
    import: (input) => invoke('scenes:import', input),
    approve: async (id) => void (await invoke('scenes:approve', { id })),
    saveRevision: (episodeId) => invoke('scenes:save-revision', { id: episodeId }),
    listRevisions: (episodeId) => invoke('scenes:list-revisions', { id: episodeId }),
  },
  assets: {
    create: (input) => invoke('assets:create', input),
    update: (input) => invoke('assets:update', input),
    delete: async (id) => void (await invoke('assets:delete', { id })),
    addReference: (episodeId) => invoke('references:add', { id: episodeId }),
    refreshReferences: (episodeId) => invoke('references:refresh', { id: episodeId }),
    deleteReference: async (id) => void (await invoke('references:delete', { id })),
  },
  backup: {
    export: () => invoke('backup:export'),
    restore: () => invoke('backup:restore'),
  },
};

contextBridge.exposeInMainWorld('studio', api);
