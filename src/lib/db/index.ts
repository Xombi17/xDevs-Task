// Server-only. Never import this module from client code.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL, TRIGGERS_SQL } from "@/lib/db/ddl";

export function openDb(file: string): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA_SQL);
  db.exec(TRIGGERS_SQL);
  return db;
}

// Stored on globalThis so Next dev HMR does not open a new handle per reload.
const KEY = Symbol.for("signseal.db");
type G = typeof globalThis & { [KEY]?: Database.Database };

export function getDb(): Database.Database {
  const g = globalThis as G;
  if (!g[KEY]) g[KEY] = openDb(process.env.DB_PATH ?? "./data/signseal.db");
  return g[KEY];
}
