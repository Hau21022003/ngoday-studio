import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RUNTIME_DIR = path.join(HERE, '.runtime');
export const DOWNLOAD_DIR = path.join(HERE, 'downloads');
export const STATE_PATH = path.join(RUNTIME_DIR, 'state.json');
export const EVENTS_PATH = path.join(RUNTIME_DIR, 'events.ndjson');
export const FLOW_URL = 'https://labs.google/fx/tools/flow';
export const browserChannel = process.env.FLOW_POC_BROWSER || 'chrome';

const localAppData = process.env.LOCALAPPDATA;
if (!localAppData) {
  throw new Error('LOCALAPPDATA is required on Windows for the dedicated Chrome profile');
}

export const PROFILE_DIR =
  process.env.FLOW_POC_PROFILE_DIR ||
  path.join(localAppData, 'NgodayStudio', 'GoogleFlowChromeProfile');

export function findInstalledBrowser() {
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env['ProgramFiles(x86)'];
  const candidates =
    browserChannel === 'msedge'
      ? [
          programFiles && path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          programFilesX86 && path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ]
      : [
          programFiles && path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          programFilesX86 && path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ];

  const executable = candidates.filter(Boolean).find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error(`Could not find installed browser for channel: ${browserChannel}`);
  }
  return executable;
}
