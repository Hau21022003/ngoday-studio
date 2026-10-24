import { contextBridge, ipcRenderer } from "electron"

import type { IpcResult } from "../shared/domain"
import { studioChannels, type StudioBridge } from "../shared/ipc"

function invoke<T>(channel: string, input: unknown): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, input) as Promise<IpcResult<T>>
}

const studio: StudioBridge = {
  environment: {
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
    },
  },
  templates: {
    list: (input) => invoke(studioChannels.templatesList, input),
    get: (input) => invoke(studioChannels.templatesGet, input),
    create: (input) => invoke(studioChannels.templatesCreate, input),
    updateMetadata: (input) => invoke(studioChannels.templatesUpdateMetadata, input),
    createVersion: (input) => invoke(studioChannels.templatesCreateVersion, input),
    render: (input) => invoke(studioChannels.templatesRender, input),
  },
  episodes: {
    list: (input) => invoke(studioChannels.episodesList, input),
    get: (input) => invoke(studioChannels.episodesGet, input),
    create: (input) => invoke(studioChannels.episodesCreate, input),
    update: (input) => invoke(studioChannels.episodesUpdate, input),
    archive: (input) => invoke(studioChannels.episodesArchive, input),
  },
  sceneCreation: {
    renderPrompt: (input) => invoke(studioChannels.sceneCreationRenderPrompt, input),
    validateImport: (input) => invoke(studioChannels.sceneCreationValidateImport, input),
    commitImport: (input) => invoke(studioChannels.sceneCreationCommitImport, input),
  },
  scenes: {
    list: (input) => invoke(studioChannels.scenesList, input),
    get: (input) => invoke(studioChannels.scenesGet, input),
    update: (input) => invoke(studioChannels.scenesUpdate, input),
    reorder: (input) => invoke(studioChannels.scenesReorder, input),
    transitionStatus: (input) => invoke(studioChannels.scenesTransitionStatus, input),
  },
  assetSlots: {
    list: (input) => invoke(studioChannels.assetSlotsList, input),
    create: (input) => invoke(studioChannels.assetSlotsCreate, input),
    update: (input) => invoke(studioChannels.assetSlotsUpdate, input),
  },
  assets: {
    list: (input) => invoke(studioChannels.assetsList, input),
    get: (input) => invoke(studioChannels.assetsGet, input),
    registerImported: (input) => invoke(studioChannels.assetsRegisterImported, input),
    accept: (input) => invoke(studioChannels.assetsAccept, input),
    reject: (input) => invoke(studioChannels.assetsReject, input),
    archive: (input) => invoke(studioChannels.assetsArchive, input),
  },
}

contextBridge.exposeInMainWorld("studio", studio)
