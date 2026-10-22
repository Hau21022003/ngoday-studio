import { DatabaseSync } from 'node:sqlite';
import { phase1Migration } from './migrations/001-phase1.js';

export type StudioDatabase = DatabaseSync;

export function openDatabase(filename: string): StudioDatabase {
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA busy_timeout = 5000');
  migrate(database);
  return database;
}

function migrate(database: StudioDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = database.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(1);
  if (applied) return;

  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(phase1Migration);
    database
      .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(1, new Date().toISOString());
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
