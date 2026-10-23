import { contextBridge } from "electron"

contextBridge.exposeInMainWorld("studio", {
  environment: {
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
    },
  },
})
