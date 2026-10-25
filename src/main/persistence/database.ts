import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

export class StudioDatabase {
  readonly connection: DatabaseSync
  readonly path: string

  constructor(path: string) {
    this.path = path
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
    this.connection = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
      timeout: 5_000,
    })
    this.connection.exec("PRAGMA foreign_keys = ON")
    this.connection.exec("PRAGMA busy_timeout = 5000")
    if (path !== ":memory:") this.connection.exec("PRAGMA journal_mode = WAL")
  }

  transaction<T>(operation: () => T): T {
    this.connection.exec("BEGIN IMMEDIATE")
    try {
      const result = operation()
      this.connection.exec("COMMIT")
      return result
    } catch (error) {
      try {
        this.connection.exec("ROLLBACK")
      } catch {
        // Preserve the original transaction error.
      }
      throw error
    }
  }

  close() {
    this.connection.close()
  }
}
