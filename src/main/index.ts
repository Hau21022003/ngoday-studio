import { app, BrowserWindow, dialog, ipcMain, shell } from "electron"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { registerStudioIpc } from "./ipc/register-studio-ipc"
import { defaultPersistencePaths, initializePersistence, type PersistenceFoundation } from "./persistence/foundation"
import { preloadEntryFileName } from "../shared/runtime-paths"

if (process.env.NGODAY_DEBUG_PORT) {
  app.commandLine.appendSwitch("remote-debugging-port", process.env.NGODAY_DEBUG_PORT)
}

async function createWindow(showOnReady = true) {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 860,
    minHeight: 640,
    backgroundColor: "#faf8f4",
    show: false,
    titleBarStyle: "default",
    webPreferences: {
      preload: join(__dirname, "../preload", preloadEntryFileName),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (showOnReady) window.once("ready-to-show", () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url)
    return { action: "deny" }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await window.loadFile(join(__dirname, "../renderer/index.html"))
  }
  return window
}

let persistence: PersistenceFoundation | null = null

function runPersistenceSmoke(foundation: PersistenceFoundation, smokeRoot: string, phase: string) {
  if (phase === "write") {
    const template = foundation.services.templates.create({
      name: "Packaged restart template",
      description: "Template fixture chỉ tồn tại trong thư mục smoke tạm thời.",
      purpose: "scene",
      status: "active",
      content: "Tạo một scene kiểm tra package.",
      variables: [],
      changeNote: "Khởi tạo packaged smoke.",
      createdByName: "Package Verify",
    })
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
    const thumbnail = foundation.services.episodeThumbnails.import({
      fileName: "package-smoke.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
    })
    const episode = foundation.services.episodes.create({
      title: "Packaged restart episode",
      topic: "science",
      description: "Episode fixture dùng để xác nhận dữ liệu còn nguyên sau restart.",
      notes: "Packaged restart note",
      thumbnailRelativePath: thumbnail.relativePath,
      createdByName: "Package Verify",
    })
    writeFileSync(join(smokeRoot, "persistence-smoke-write.json"), JSON.stringify({
      migration: foundation.migration,
      templateId: template.id,
      episodeId: episode.id,
      thumbnailRelativePath: thumbnail.relativePath,
    }))
    return
  }

  if (phase === "read") {
    const fixture = JSON.parse(readFileSync(join(smokeRoot, "persistence-smoke-write.json"), "utf8")) as {
      templateId: string
      episodeId: string
      thumbnailRelativePath: string
    }
    const template = foundation.services.templates.get(fixture.templateId)
    const episode = foundation.services.episodes.get(fixture.episodeId)
    const thumbnail = foundation.services.episodeThumbnails.read({ relativePath: fixture.thumbnailRelativePath })
    if (
      template.name !== "Packaged restart template"
      || template.versions.length !== 1
      || episode.notes !== "Packaged restart note"
      || episode.thumbnailRelativePath !== fixture.thumbnailRelativePath
      || !thumbnail.dataUrl.startsWith("data:image/png;base64,")
    ) {
      throw new Error("Packaged restart persistence fixture did not survive relaunch.")
    }
    writeFileSync(join(smokeRoot, "persistence-smoke-read.json"), JSON.stringify({
      migration: foundation.migration,
      templateId: template.id,
      episodeId: episode.id,
      thumbnailRelativePath: thumbnail.relativePath,
    }))
    return
  }

  throw new Error(`Unknown persistence smoke phase: ${phase}`)
}

async function runBridgeSmoke(smokeRoot: string, phase: "bridge-write" | "bridge-read") {
  const window = await createWindow(false)
  try {
    if (phase === "bridge-write") {
      const pngBase64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString("base64")
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          const api = window.studio
          if (!api) throw new Error("window.studio is undefined")
          const unwrap = (result) => {
            if (!result.ok) throw new Error(result.error.code + ": " + result.error.message)
            return result.data
          }
          const createdTemplate = unwrap(await api.templates.create({
            name: "Bridge packaged template",
            description: "Template được tạo qua preload bridge trong packaged app.",
            purpose: "scene",
            status: "active",
            content: "Bridge template version one.",
            variables: [],
            changeNote: "Khởi tạo qua bridge.",
            createdByName: "Package Bridge"
          }))
          const savedTemplate = unwrap(await api.templates.saveEdit({
            id: createdTemplate.id,
            expectedRevisionNo: createdTemplate.revisionNo,
            patch: { description: "Template đã lưu metadata và version qua preload bridge." },
            version: {
              content: "Bridge template version two.",
              variables: [],
              changeNote: "Version mới qua bridge.",
              createdByName: "Package Bridge"
            }
          }))
          const rendered = unwrap(await api.templates.render({
            templateVersionId: savedTemplate.versions[0].id,
            values: {}
          }))
          const thumbnail = unwrap(await api.episodeThumbnails.import({
            fileName: "bridge.png",
            mimeType: "image/png",
            dataBase64: ${JSON.stringify(pngBase64)}
          }))
          const thumbnailRead = unwrap(await api.episodeThumbnails.read({ relativePath: thumbnail.relativePath }))
          const createdEpisode = unwrap(await api.episodes.create({
            title: "Bridge packaged episode",
            topic: "science",
            description: "Episode được tạo qua preload bridge trong packaged app.",
            notes: "Bridge draft one",
            thumbnailRelativePath: thumbnail.relativePath,
            createdByName: "Package Bridge"
          }))
          const episodeTwo = unwrap(await api.episodes.update({
            id: createdEpisode.id,
            expectedRevisionNo: createdEpisode.revisionNo,
            updatedByName: "Package Bridge",
            patch: { notes: "Bridge draft two" }
          }))
          const episodeThree = unwrap(await api.episodes.update({
            id: createdEpisode.id,
            expectedRevisionNo: episodeTwo.revisionNo,
            updatedByName: "Package Bridge",
            patch: { notes: "Bridge latest draft" }
          }))
          return {
            templateId: savedTemplate.id,
            templateRevisionNo: savedTemplate.revisionNo,
            templateVersionCount: savedTemplate.versions.length,
            renderedContent: rendered.content,
            episodeId: episodeThree.id,
            episodeRevisionNo: episodeThree.revisionNo,
            episodeNotes: episodeThree.notes,
            thumbnailRelativePath: thumbnail.relativePath,
            thumbnailReadable: thumbnailRead.dataUrl.startsWith("data:image/png;base64,")
          }
        })()
      `, true) as {
        templateId: string
        templateRevisionNo: number
        templateVersionCount: number
        renderedContent: string
        episodeId: string
        episodeRevisionNo: number
        episodeNotes: string
        thumbnailRelativePath: string
        thumbnailReadable: boolean
      }
      if (
        result.templateRevisionNo !== 2
        || result.templateVersionCount !== 2
        || result.renderedContent !== "Bridge template version two."
        || result.episodeRevisionNo !== 3
        || result.episodeNotes !== "Bridge latest draft"
        || !result.thumbnailReadable
      ) {
        throw new Error("Packaged preload bridge write flow returned unexpected data.")
      }
      writeFileSync(join(smokeRoot, "persistence-smoke-bridge-write.json"), JSON.stringify(result))
      return
    }

    const fixture = JSON.parse(readFileSync(join(smokeRoot, "persistence-smoke-bridge-write.json"), "utf8")) as {
      templateId: string
      episodeId: string
      episodeRevisionNo: number
      thumbnailRelativePath: string
    }
    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const api = window.studio
        if (!api) throw new Error("window.studio is undefined after restart")
        const unwrap = (result) => {
          if (!result.ok) throw new Error(result.error.code + ": " + result.error.message)
          return result.data
        }
        const fixture = ${JSON.stringify(fixture)}
        const template = unwrap(await api.templates.get({ id: fixture.templateId }))
        const episode = unwrap(await api.episodes.get({ id: fixture.episodeId }))
        const thumbnail = unwrap(await api.episodeThumbnails.read({ relativePath: fixture.thumbnailRelativePath }))
        const templates = unwrap(await api.templates.list({ page: 1, pageSize: 100, search: "Bridge packaged" }))
        const episodes = unwrap(await api.episodes.list({ page: 1, pageSize: 100, search: "Bridge packaged" }))
        const updatedEpisode = unwrap(await api.episodes.update({
          id: episode.id,
          expectedRevisionNo: episode.revisionNo,
          updatedByName: "Package Bridge",
          patch: { notes: "Bridge autosave after restart" }
        }))
        return {
          templateRevisionNo: template.revisionNo,
          templateVersionCount: template.versions.length,
          episodeRevisionNo: updatedEpisode.revisionNo,
          episodeNotes: updatedEpisode.notes,
          templateListContainsFixture: templates.items.some((item) => item.id === fixture.templateId),
          episodeListContainsFixture: episodes.items.some((item) => item.id === fixture.episodeId),
          thumbnailReadable: thumbnail.dataUrl.startsWith("data:image/png;base64,")
        }
      })()
    `, true) as {
      templateRevisionNo: number
      templateVersionCount: number
      episodeRevisionNo: number
      episodeNotes: string
      templateListContainsFixture: boolean
      episodeListContainsFixture: boolean
      thumbnailReadable: boolean
    }
    if (
      result.templateRevisionNo !== 2
      || result.templateVersionCount !== 2
      || result.episodeRevisionNo !== fixture.episodeRevisionNo + 1
      || result.episodeNotes !== "Bridge autosave after restart"
      || !result.templateListContainsFixture
      || !result.episodeListContainsFixture
      || !result.thumbnailReadable
    ) {
      throw new Error("Packaged preload bridge data did not survive relaunch.")
    }
    writeFileSync(join(smokeRoot, "persistence-smoke-bridge-read.json"), JSON.stringify(result))
  } finally {
    window.destroy()
  }
}

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
      const phase = process.env.NGODAY_PERSISTENCE_SMOKE_PHASE ?? ""
      if (phase === "bridge-write" || phase === "bridge-read") {
        registerStudioIpc(ipcMain, persistence)
        await runBridgeSmoke(smokeRoot!, phase)
      } else {
        runPersistenceSmoke(persistence, smokeRoot!, phase)
      }
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

  void createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on("before-quit", () => {
  persistence?.close()
  persistence = null
})

app.on("window-all-closed", () => {
  if (process.env.NGODAY_PERSISTENCE_SMOKE === "1") return
  if (process.platform !== "darwin") app.quit()
})
