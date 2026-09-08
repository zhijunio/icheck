import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let database: Database.Database | undefined;

export function getDatabase() {
  if (database) return database;

  const filePath = process.env.SQLITE_DATABASE_PATH ?? "data/icheck.db";
  mkdirSync(dirname(filePath), { recursive: true });
  database = new Database(filePath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return database;
}
