import { sha256 } from "../domain/helpers"
import { DomainError } from "../domain/errors"
import { createVerifiedBackup } from "./backup"
import type { StudioDatabase } from "./database"
import type { Migration } from "./migration-catalog"

type AppliedMigrationRow = {
  version: number
  name: string
  checksum: string
  applied_at: string
  app_version: string
}

export type MigrationRunResult = {
  fromVersion: number
  toVersion: number
  appliedVersions: number[]
  backupPath: string | null
}

function tableExists(database: StudioDatabase, tableName: string) {
  return Boolean(
    database.connection
      .prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  )
}

function userTableNames(database: StudioDatabase) {
  return database.connection
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row.name))
}

function readApplied(database: StudioDatabase): AppliedMigrationRow[] {
  if (!tableExists(database, "schema_migrations")) return []
  return database.connection
    .prepare("SELECT version, name, checksum, applied_at, app_version FROM schema_migrations ORDER BY version")
    .all() as AppliedMigrationRow[]
}

export async function runMigrations(options: {
  database: StudioDatabase
  catalog: readonly Migration[]
  appVersion: string
  backupDirectory: string
}): Promise<MigrationRunResult> {
  const { database, catalog, appVersion, backupDirectory } = options
  const tables = userTableNames(database)
  if (!tables.includes("schema_migrations") && tables.length > 0) {
    throw new DomainError(
      "MIGRATION_REQUIRED",
      "Database có schema chưa được quản lý. Startup đã dừng để tránh ghi đè dữ liệu.",
    )
  }

  const applied = readApplied(database)
  const catalogByVersion = new Map(catalog.map((migration) => [migration.version, migration]))
  for (const row of applied) {
    const migration = catalogByVersion.get(row.version)
    if (!migration) {
      throw new DomainError("MIGRATION_REQUIRED", `Database đang ở migration ${row.version} không có trong ứng dụng.`)
    }
    if (row.name !== migration.name || row.checksum !== sha256(migration.sql)) {
      throw new DomainError(
        "MIGRATION_REQUIRED",
        `Checksum migration ${row.version}_${row.name} không khớp. Không migration nào được chạy.`,
      )
    }
  }

  const currentVersion = applied.at(-1)?.version ?? 0
  const pending = catalog.filter((migration) => migration.version > currentVersion)
  if (pending.length === 0) {
    return { fromVersion: currentVersion, toVersion: currentVersion, appliedVersions: [], backupPath: null }
  }

  for (let index = 0; index < pending.length; index += 1) {
    const expectedVersion = currentVersion + index + 1
    if (pending[index]?.version !== expectedVersion) {
      throw new DomainError("MIGRATION_REQUIRED", `Migration catalog thiếu version liên tục ${expectedVersion}.`)
    }
  }

  const backupPath = currentVersion > 0
    ? await createVerifiedBackup(database, backupDirectory, currentVersion)
    : null
  const appliedVersions: number[] = []

  for (const migration of pending) {
    try {
      database.transaction(() => {
        database.connection.exec(migration.sql)
        database.connection
          .prepare(
            "INSERT INTO schema_migrations (version, name, checksum, applied_at, app_version) VALUES (?, ?, ?, ?, ?)",
          )
          .run(migration.version, migration.name, sha256(migration.sql), new Date().toISOString(), appVersion)
      })
      appliedVersions.push(migration.version)
    } catch (error) {
      throw new DomainError(
        "MIGRATION_REQUIRED",
        `Migration ${migration.version}_${migration.name} thất bại và đã rollback.${backupPath ? ` Backup: ${backupPath}` : ""}`,
        { cause: error },
      )
    }
  }

  return {
    fromVersion: currentVersion,
    toVersion: pending.at(-1)?.version ?? currentVersion,
    appliedVersions,
    backupPath,
  }
}
