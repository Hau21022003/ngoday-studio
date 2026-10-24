import { app, BrowserWindow, dialog, ipcMain, shell } from "electron"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { registerStudioIpc } from "./ipc/register-studio-ipc"
import { defaultPersistencePaths, initializePersistence, type PersistenceFoundation } from "./persistence/foundation"

if (process.env.NGODAY_DEBUG_PORT) {
  app.commandLine.appendSwitch("remote-debugging-port", process.env.NGODAY_DEBUG_PORT)
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 860,
    minHeight: 640,
    backgroundColor: "#faf8f4",
    show: false,
    titleBarStyle: "default",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once("ready-to-show", () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url)
    return { action: "deny" }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

let persistence: PersistenceFoundation | null = null

app.whenReady().then(async () => {
  try {
    const smokeRoot = process.env.NGODAY_PERSISTENCE_SMOKE_ROOT
    const paths = smokeRoot
      ? {
          databasePath: join(smokeRoot, "data", "ngoday-studio.sqlite3"),
          backupDirectory: join(smokeRoot, "backups"),
          workspaceRoot: join(smokeRoot, "workspace"),
        }
      : defaultPersistencePaths(app.getPath("userData"))
    persistence = await initializePersistence({ ...paths, appVersion: app.getVersion() })
    if (process.env.NGODAY_PERSISTENCE_SMOKE === "1") {
      writeFileSync(join(smokeRoot!, "persistence-smoke-ok.json"), JSON.stringify(persistence.migration))
      persistence.close()
      persistence = null
      app.exit(0)
      return
    }
    registerStudioIpc(ipcMain, persistence)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const smokeRoot = process.env.NGODAY_PERSISTENCE_SMOKE_ROOT
    if (process.env.NGODAY_PERSISTENCE_SMOKE === "1" && smokeRoot) {
      writeFileSync(join(smokeRoot, "persistence-smoke-error.txt"), message)
      app.exit(1)
      return
    }
    dialog.showErrorBox("Không thể khởi tạo dữ liệu", message)
    app.quit()
    return
  }

  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("before-quit", () => {
  persistence?.close()
  persistence = null
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
