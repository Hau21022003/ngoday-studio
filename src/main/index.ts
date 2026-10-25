import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
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

function parentWindow(event: unknown) {
  return event && typeof event === "object" && "sender" in event
    ? BrowserWindow.fromWebContents((event as IpcMainInvokeEvent).sender) ?? undefined
    : undefined
}

const platformActions = {
  async chooseAssetFile(event: unknown) {
    const options: OpenDialogOptions = {
      title: "Import Asset candidate",
      properties: ["openFile"],
      filters: [
        { name: "Ảnh và video", extensions: ["png", "jpg", "jpeg", "webp", "mp4", "webm", "mov"] },
      ],
    }
    const parent = parentWindow(event)
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0] ?? null
  },
  async chooseMetadataBackupDestination(event: unknown) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const options: SaveDialogOptions = {
      title: "Xuất metadata backup",
      defaultPath: `ngoday-studio-metadata-${timestamp}.json`,
      filters: [{ name: "Ngộ Dậy metadata backup", extensions: ["json"] }],
      properties: ["showOverwriteConfirmation"],
    }
    const parent = parentWindow(event)
    const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
    return result.canceled ? null : result.filePath ?? null
  },
  async chooseMetadataBackupSource(event: unknown) {
    const options: OpenDialogOptions = {
      title: "Chọn metadata backup để restore",
      properties: ["openFile"],
      filters: [{ name: "Ngộ Dậy metadata backup", extensions: ["json"] }],
    }
    const parent = parentWindow(event)
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0] ?? null
  },
  async openFile(path: string) {
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  },
  revealFile(path: string) {
    shell.showItemInFolder(path)
  },
}

async function runPersistenceSmoke(foundation: PersistenceFoundation, smokeRoot: string, phase: string) {
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
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0])
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
    const rawJson = JSON.stringify({
      schemaVersion: 1,
      scenes: [{
        order: 1,
        title: "Packaged Asset Scene",
        narration: "Narration packaged smoke.",
        visualDescription: "Visual packaged smoke.",
        sceneType: "ENVIRONMENT",
        mediaType: "image",
        assetSlots: [{ order: 1, mediaType: "image", prompt: "Packaged asset prompt", required: true }],
      }],
    })
    const preview = foundation.services.sceneCreation.validateImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
    })
    const imported = foundation.services.sceneCreation.commitImport({
      episodeId: episode.id,
      templateVersionId: template.versions[0]!.id,
      mode: "append",
      rawJson,
      payloadHash: preview.payloadHash,
      expectedEpisodeRevisionNo: episode.revisionNo,
    })
    foundation.services.scenes.transitionStatus({ id: imported.scenes[0]!.id, expectedRevisionNo: 1, status: "approved" })
    const sourceAssetPath = join(smokeRoot, "package-asset-source.png")
    writeFileSync(sourceAssetPath, png)
    const slot = foundation.services.assetSlots.list(episode.id)[0]!
    const candidate = await foundation.services.assets.importFile({
      assetSlotId: slot.id,
      expectedAssetSlotRevisionNo: slot.revisionNo,
    }, sourceAssetPath)
    const accepted = foundation.services.assets.accept({ id: candidate.id, expectedRevisionNo: candidate.revisionNo })
    const metadataBackupPath = join(smokeRoot, "package-metadata-backup.json")
    foundation.services.metadataBackup.exportTo(metadataBackupPath)

    const restoreRoot = join(smokeRoot, "metadata-restore-smoke")
    const restoredFoundation = await initializePersistence({
      databasePath: join(restoreRoot, "data", "ngoday-studio.sqlite3"),
      backupDirectory: join(restoreRoot, "backups"),
      workspaceRoot: join(restoreRoot, "workspace"),
      appVersion: app.getVersion(),
    })
    try {
      const restored = restoredFoundation.services.metadataBackup.restoreFrom(metadataBackupPath)
      if (restored.summary.assets !== 1 || restoredFoundation.services.assets.get(accepted.id).fileIntegrity !== "missing") {
        throw new Error("Packaged metadata restore did not preserve Asset metadata without binary.")
      }
    } finally {
      restoredFoundation.close()
    }
    writeFileSync(join(smokeRoot, "persistence-smoke-write.json"), JSON.stringify({
      migration: foundation.migration,
      templateId: template.id,
      episodeId: episode.id,
      thumbnailRelativePath: thumbnail.relativePath,
      assetId: accepted.id,
      metadataBackupPath,
    }))
    return
  }

  if (phase === "read") {
    const fixture = JSON.parse(readFileSync(join(smokeRoot, "persistence-smoke-write.json"), "utf8")) as {
      templateId: string
      episodeId: string
      thumbnailRelativePath: string
      assetId: string
      metadataBackupPath: string
    }
    const template = foundation.services.templates.get(fixture.templateId)
    const episode = foundation.services.episodes.get(fixture.episodeId)
    const thumbnail = foundation.services.episodeThumbnails.read({ relativePath: fixture.thumbnailRelativePath })
    const asset = foundation.services.assets.get(fixture.assetId)
    if (
      template.name !== "Packaged restart template"
      || template.versions.length !== 1
      || episode.notes !== "Packaged restart note"
      || episode.thumbnailRelativePath !== fixture.thumbnailRelativePath
      || !thumbnail.dataUrl.startsWith("data:image/png;base64,")
      || asset.status !== "accepted"
      || asset.fileIntegrity !== "available"
      || episode.workflowStatus !== "ready_to_export"
      || !existsSync(fixture.metadataBackupPath)
    ) {
      throw new Error("Packaged restart persistence fixture did not survive relaunch.")
    }
    writeFileSync(join(smokeRoot, "persistence-smoke-read.json"), JSON.stringify({
      migration: foundation.migration,
      templateId: template.id,
      episodeId: episode.id,
      thumbnailRelativePath: thumbnail.relativePath,
      assetId: asset.id,
      assetIntegrity: asset.fileIntegrity,
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
          const sceneVariables = [
            { name: "episode_title", label: "Episode title", required: true },
            { name: "topic", label: "Topic", required: true },
            { name: "notes", label: "Notes", required: true },
            { name: "source_content", label: "Source", required: false }
          ].map((variable) => ({
            id: crypto.randomUUID(),
            name: variable.name,
            label: variable.label,
            description: "Packaged M7 Scene variable.",
            type: "text",
            required: variable.required,
            defaultValue: "",
            options: []
          }))
          const createdTemplate = unwrap(await api.templates.create({
            name: "Bridge packaged template",
            description: "Template được tạo qua preload bridge trong packaged app.",
            purpose: "scene",
            status: "active",
            content: "Bridge template version one for {{episode_title}}.",
            variables: sceneVariables.filter((variable) => variable.name === "episode_title"),
            changeNote: "Khởi tạo qua bridge.",
            createdByName: "Package Bridge"
          }))
          const savedTemplate = unwrap(await api.templates.saveEdit({
            id: createdTemplate.id,
            expectedRevisionNo: createdTemplate.revisionNo,
            patch: { description: "Template đã lưu metadata và version qua preload bridge." },
            version: {
              content: "Bridge template version two for {{episode_title}}. Topic {{topic}}. Notes {{notes}}. Source {{source_content}}.",
              variables: sceneVariables,
              changeNote: "Version mới qua bridge.",
              createdByName: "Package Bridge"
            }
          }))
          const rendered = unwrap(await api.templates.render({
            templateVersionId: savedTemplate.versions[0].id,
            values: {
              episode_title: "Direct render",
              topic: "science",
              notes: "Direct notes",
              source_content: ""
            }
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
          const renderedScenePrompt = unwrap(await api.sceneCreation.renderPrompt({
            episodeId: episodeThree.id,
            templateVersionId: savedTemplate.versions[0].id,
            sourceContent: "Bridge transient source"
          }))
          const rawScenes = JSON.stringify({
            schemaVersion: 1,
            scenes: [
              {
                order: 1,
                title: "Bridge Scene A",
                narration: "Bridge narration A",
                visualDescription: "Bridge visual A",
                sceneType: "ENVIRONMENT",
                mediaType: "image",
                assetSlots: [{ order: 1, mediaType: "image", prompt: "Bridge prompt A", required: true }]
              },
              {
                order: 2,
                title: "Bridge Scene B",
                narration: "Bridge narration B",
                visualDescription: "Bridge visual B",
                sceneType: "B_ROLL",
                mediaType: "video",
                assetSlots: [{ order: 1, mediaType: "video", prompt: "Bridge prompt B", required: true }]
              }
            ]
          })
          const scenePreview = unwrap(await api.sceneCreation.validateImport({
            episodeId: episodeThree.id,
            templateVersionId: savedTemplate.versions[0].id,
            renderedPromptHash: renderedScenePrompt.contentHash,
            mode: "append",
            rawJson: rawScenes
          }))
          const importedScenes = unwrap(await api.sceneCreation.commitImport({
            episodeId: episodeThree.id,
            templateVersionId: savedTemplate.versions[0].id,
            renderedPromptHash: renderedScenePrompt.contentHash,
            mode: "append",
            rawJson: rawScenes,
            payloadHash: scenePreview.payloadHash,
            expectedEpisodeRevisionNo: episodeThree.revisionNo
          }))
          const editedScene = unwrap(await api.scenes.update({
            id: importedScenes.scenes[0].id,
            expectedRevisionNo: importedScenes.scenes[0].revisionNo,
            patch: { summary: "Bridge summary persisted" }
          }))
          const approvedSceneA = unwrap(await api.scenes.transitionStatus({
            id: editedScene.id,
            status: "approved",
            expectedRevisionNo: editedScene.revisionNo
          }))
          unwrap(await api.scenes.transitionStatus({
            id: importedScenes.scenes[1].id,
            status: "approved",
            expectedRevisionNo: importedScenes.scenes[1].revisionNo
          }))
          const reorderedScenes = unwrap(await api.scenes.reorder({
            episodeId: episodeThree.id,
            orderedSceneIds: [importedScenes.scenes[1].id, importedScenes.scenes[0].id],
            expectedEpisodeRevisionNo: importedScenes.episodeRevisionNo
          }))
          return {
            templateId: savedTemplate.id,
            templateVersionId: savedTemplate.versions[0].id,
            templateRevisionNo: savedTemplate.revisionNo,
            templateVersionCount: savedTemplate.versions.length,
            renderedContent: rendered.content,
            episodeId: episodeThree.id,
            episodeRevisionNo: importedScenes.episodeRevisionNo + 1,
            episodeNotes: episodeThree.notes,
            sceneIds: importedScenes.scenes.map((scene) => scene.id),
            sceneOrder: reorderedScenes.map((scene) => scene.id),
            approvedSceneRevisionBeforeReorder: approvedSceneA.revisionNo,
            renderedSceneContent: renderedScenePrompt.content,
            thumbnailRelativePath: thumbnail.relativePath,
            thumbnailReadable: thumbnailRead.dataUrl.startsWith("data:image/png;base64,")
          }
        })()
      `, true) as {
        templateId: string
        templateVersionId: string
        templateRevisionNo: number
        templateVersionCount: number
        renderedContent: string
        episodeId: string
        episodeRevisionNo: number
        episodeNotes: string
        sceneIds: string[]
        sceneOrder: string[]
        approvedSceneRevisionBeforeReorder: number
        renderedSceneContent: string
        thumbnailRelativePath: string
        thumbnailReadable: boolean
      }
      if (
        result.templateRevisionNo !== 2
        || result.templateVersionCount !== 2
        || result.renderedContent !== "Bridge template version two for Direct render. Topic science. Notes Direct notes. Source ."
        || result.episodeRevisionNo !== 5
        || result.episodeNotes !== "Bridge latest draft"
        || result.sceneOrder[0] !== result.sceneIds[1]
        || result.sceneOrder[1] !== result.sceneIds[0]
        || result.approvedSceneRevisionBeforeReorder !== 3
        || !result.renderedSceneContent.includes("Bridge packaged episode")
        || !result.renderedSceneContent.includes("Bridge transient source")
        || !result.thumbnailReadable
      ) {
        throw new Error("Packaged preload bridge write flow returned unexpected data.")
      }
      writeFileSync(join(smokeRoot, "persistence-smoke-bridge-write.json"), JSON.stringify(result))
      return
    }

    const fixture = JSON.parse(readFileSync(join(smokeRoot, "persistence-smoke-bridge-write.json"), "utf8")) as {
      templateId: string
      templateVersionId: string
      episodeId: string
      episodeRevisionNo: number
      sceneIds: string[]
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
        const scenes = unwrap(await api.scenes.list({ episodeId: fixture.episodeId }))
        const sceneA = unwrap(await api.scenes.get({ id: fixture.sceneIds[0] }))
        const sceneB = unwrap(await api.scenes.get({ id: fixture.sceneIds[1] }))
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
          sceneCount: scenes.length,
          sceneOrder: scenes.map((scene) => scene.id),
          sceneAApproved: sceneA.status === "approved" && sceneA.summary === "Bridge summary persisted",
          sceneBCanonicalNo: sceneB.canonicalNo,
          sceneAPrompt: sceneA.assetSlots[0]?.prompt,
          sceneAHasProvenance: sceneA.provenance?.templateVersionId === fixture.templateVersionId,
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
      sceneCount: number
      sceneOrder: string[]
      sceneAApproved: boolean
      sceneBCanonicalNo: number
      sceneAPrompt: string
      sceneAHasProvenance: boolean
      templateListContainsFixture: boolean
      episodeListContainsFixture: boolean
      thumbnailReadable: boolean
    }
    if (
      result.templateRevisionNo !== 2
      || result.templateVersionCount !== 2
      || result.episodeRevisionNo !== fixture.episodeRevisionNo + 1
      || result.episodeNotes !== "Bridge autosave after restart"
      || result.sceneCount !== 2
      || result.sceneOrder[0] !== fixture.sceneIds[1]
      || result.sceneOrder[1] !== fixture.sceneIds[0]
      || !result.sceneAApproved
      || result.sceneBCanonicalNo !== 2
      || result.sceneAPrompt !== "Bridge prompt A"
      || !result.sceneAHasProvenance
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
        registerStudioIpc(ipcMain, persistence, platformActions)
        await runBridgeSmoke(smokeRoot!, phase)
      } else {
        await runPersistenceSmoke(persistence, smokeRoot!, phase)
      }
      persistence.close()
      persistence = null
      app.exit(0)
      return
    }
    registerStudioIpc(ipcMain, persistence, platformActions)
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
