import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { initializePersistence, type PersistenceFoundation } from "../../src/main/persistence/foundation"

export type TempFoundation = {
  root: string
  workspace: string
  foundation: PersistenceFoundation
  cleanup(): void
}

export async function createTempFoundation(): Promise<TempFoundation> {
  const root = mkdtempSync(join(tmpdir(), "ngoday-m5b-"))
  const workspace = join(root, "workspace")
  mkdirSync(workspace, { recursive: true })
  const foundation = await initializePersistence({
    databasePath: join(root, "studio.sqlite3"),
    backupDirectory: join(root, "backups"),
    workspaceRoot: workspace,
    appVersion: "test",
  })
  let closed = false
  return {
    root,
    workspace,
    foundation,
    cleanup() {
      if (!closed) {
        foundation.close()
        closed = true
      }
      rmSync(root, { recursive: true, force: true })
    },
  }
}
