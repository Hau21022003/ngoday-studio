import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, shell } from 'electron';
import { openDatabase } from './database/connection.js';
import { registerIpcHandlers } from './ipc/register-handlers.js';
import { StudioRepository } from './repositories/studio-repository.js';
import { AssetService } from './services/asset-service.js';
import { BackupService } from './services/backup-service.js';
import { EpisodeService } from './services/episode-service.js';
import { ScriptService } from './services/script-service.js';
import { TemplateService } from './services/template-service.js';

let mainWindow: BrowserWindow | null = null;
const here = dirname(fileURLToPath(import.meta.url));
const smokeTest = process.env.NGODAY_SMOKE_TEST === '1';

if (process.env.NGODAY_USER_DATA_DIR) {
  app.setPath('userData', process.env.NGODAY_USER_DATA_DIR);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    backgroundColor: '#f4f1ea',
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!smokeTest) mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (current && url !== current) event.preventDefault();
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(here, '../renderer/index.html'));
  }

  if (smokeTest) {
    mainWindow.webContents.once('did-finish-load', () => {
      void mainWindow?.webContents
        .executeJavaScript(
          `(async () => {
          if (typeof window.studio !== 'object' || typeof window.studio.episodes?.list !== 'function') return false;
          const episodes = await window.studio.episodes.list({});
          return Array.isArray(episodes);
        })()`,
        )
        .then((ready) => {
          console.log(ready ? 'NGODAY_SMOKE_OK' : 'NGODAY_SMOKE_PRELOAD_MISSING');
          app.exit(ready ? 0 : 1);
        })
        .catch((error) => {
          console.error('NGODAY_SMOKE_FAILED', error);
          app.exit(1);
        });
    });
  }
}

app.whenReady().then(() => {
  const database = openDatabase(join(app.getPath('userData'), 'app.db'));
  const repository = new StudioRepository(database);
  const assets = new AssetService(repository);
  registerIpcHandlers({
    episodes: new EpisodeService(repository),
    templates: new TemplateService(repository),
    scripts: new ScriptService(repository, assets),
    assets,
    backup: new BackupService(repository, assets),
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('before-quit', () => database.close());
});

app.on('window-all-closed', () => app.quit());
