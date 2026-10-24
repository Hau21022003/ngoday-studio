import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { backup, DatabaseSync } from "node:sqlite"

import { DomainError } from "../domain/errors"
import type { StudioDatabase } from "./database"

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

export async function createVerifiedBackup(
  database: StudioDatabase,
  backupDirectory: string,
  currentSchemaVersion: number,
) {
  if (database.path === ":memory:") return null

  mkdirSync(backupDirectory, { recursive: true })
  database.connection.exec("PRAGMA wal_checkpoint(TRUNCATE)")
  const backupPath = join(
    backupDirectory,
    `ngoday-studio-schema-v${currentSchemaVersion}-${safeTimestamp()}.sqlite3`,
  )
  if (existsSync(backupPath)) {
    throw new DomainError("DB_UNAVAILABLE", "Đường dẫn backup đã tồn tại; migration đã dừng để tránh ghi đè.")
  }

  await backup(database.connection, backupPath)
  const verification = new DatabaseSync(backupPath)
  try {
    verification.exec("PRAGMA wal_checkpoint(TRUNCATE)")
    verification.exec("PRAGMA journal_mode = DELETE")
    const row = verification.prepare("PRAGMA integrity_check").get() as { integrity_check?: string } | undefined
    if (row?.integrity_check !== "ok") {
      throw new DomainError("DB_UNAVAILABLE", "Backup trước migration không vượt qua integrity check.")
    }
  } finally {
    verification.close()
  }

  return backupPath
}
