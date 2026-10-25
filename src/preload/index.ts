import { contextBridge, ipcRenderer } from "electron"

import type { IpcResult } from "../shared/domain"
import { createStudioBridge } from "./studio-bridge"

function invoke<T>(channel: string, input: unknown): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, input) as Promise<IpcResult<T>>
}

const studio = createStudioBridge(invoke, {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})

contextBridge.exposeInMainWorld("studio", studio)
