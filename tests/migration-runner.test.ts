import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { StudioDatabase } from "../src/main/persistence/database"
import { migrations, type Migration } from "../src/main/persistence/migration-catalog"
import { runMigrations } from "../src/main/persistence/migration-runner"

const roots: string[] = []

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "ngoday-migration-"))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("migration runner", () => {
  it("migrates an empty database and records the checksum", async () => {
    const root = tempRoot()
    const database = new StudioDatabase(join(root, "studio.sqlite3"))
    try {
      const result = await runMigrations({
        database,
        catalog: migrations,
        appVersion: "test",
        backupDirectory: join(root, "backups"),
      })
      expect(result).toMatchObject({ fromVersion: 0, toVersion: 1, appliedVersions: [1], backupPath: null })
      const tables = database.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((row) => row.name)
      expect(tables).toEqual([
        "asset_slots",
        "assets",
        "episodes",
        "prompt_template_versions",
        "prompt_templates",
        "scene_import_batches",
        "scenes",
        "schema_migrations",
      ])
      expect(database.connection.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get()).toEqual({ total: 1 })
    } finally {
      database.close()
    }
  })

  it("fails closed when an applied migration checksum changes", async () => {
    const root = tempRoot()
    const database = new StudioDatabase(join(root, "studio.sqlite3"))
    try {
      await runMigrations({ database, catalog: migrations, appVersion: "test", backupDirectory: join(root, "backups") })
      database.connection.prepare("UPDATE schema_migrations SET checksum = ? WHERE version = 1").run("0".repeat(64))
      await expect(
        runMigrations({ database, catalog: migrations, appVersion: "test", backupDirectory: join(root, "backups") }),
      ).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" })
    } finally {
      database.close()
    }
  })

  it("backs up an existing database and rolls back a failed next migration", async () => {
    const root = tempRoot()
    const database = new StudioDatabase(join(root, "studio.sqlite3"))
    const brokenMigration: Migration = {
      version: 2,
      name: "broken_fixture",
      sql: "CREATE TABLE should_rollback (id TEXT PRIMARY KEY) STRICT; THIS IS NOT SQL;",
    }
    try {
      await runMigrations({ database, catalog: migrations, appVersion: "test", backupDirectory: join(root, "backups") })
      await expect(
        runMigrations({
          database,
          catalog: [...migrations, brokenMigration],
          appVersion: "test",
          backupDirectory: join(root, "backups"),
        }),
      ).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" })
      expect(database.connection.prepare("SELECT 1 FROM sqlite_master WHERE name = 'should_rollback'").get()).toBeUndefined()
      const backups = readdirSync(join(root, "backups"))
      expect(backups).toHaveLength(1)
      expect(existsSync(join(root, "backups", backups[0]!))).toBe(true)
    } finally {
      database.close()
    }
  })

  it("upgrades an N-1 fixture with a verified backup", async () => {
    const root = tempRoot()
    const database = new StudioDatabase(join(root, "studio.sqlite3"))
    const nextMigration: Migration = {
      version: 2,
      name: "test_forward_upgrade",
      sql: "CREATE TABLE forward_fixture (id TEXT PRIMARY KEY) STRICT;",
    }
    try {
      await runMigrations({ database, catalog: migrations, appVersion: "test", backupDirectory: join(root, "backups") })
      database.connection.prepare(`
        INSERT INTO episodes (
          id, title, slug, slug_key, topic, description, notes, revision_no,
          created_by_name, updated_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, '', 1, 'Test', 'Test', ?, ?)
      `).run(
        "89aaefb8-cbf3-4123-bb34-b44db15422d5",
        "Fixture Episode",
        "fixture-episode",
        "fixture-episode",
        "science",
        "Fixture tồn tại trước migration version tiếp theo.",
        "2026-10-24T00:00:00.000Z",
        "2026-10-24T00:00:00.000Z",
      )
      const result = await runMigrations({
        database,
        catalog: [...migrations, nextMigration],
        appVersion: "test-2",
        backupDirectory: join(root, "backups"),
      })
      expect(result).toMatchObject({ fromVersion: 1, toVersion: 2, appliedVersions: [2] })
      expect(result.backupPath).not.toBeNull()
      expect(database.connection.prepare("SELECT title FROM episodes").get()).toEqual({ title: "Fixture Episode" })
      expect(database.connection.prepare("SELECT 1 AS found FROM sqlite_master WHERE name = 'forward_fixture'").get()).toEqual({ found: 1 })
    } finally {
      database.close()
    }
  })

  it("rejects an unmanaged non-empty schema", async () => {
    const root = tempRoot()
    const database = new StudioDatabase(join(root, "studio.sqlite3"))
    try {
      database.connection.exec("CREATE TABLE legacy_data (id TEXT PRIMARY KEY) STRICT")
      await expect(
        runMigrations({ database, catalog: migrations, appVersion: "test", backupDirectory: join(root, "backups") }),
      ).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" })
    } finally {
      database.close()
    }
  })
})
