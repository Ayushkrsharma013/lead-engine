/**
 * Test Database Manager
 *
 * Manages a local SQLite database that mirrors the core Supabase schema.
 * Used for test setup, assertions, and monitoring data storage.
 *
 * This runs alongside the real Supabase API — it's used for:
 * 1. Tracking test data lifecycle (create → verify → cleanup)
 * 2. Security test assertions (check what was actually written)
 * 3. Performance metrics storage (monitoring/performance_tracker.ts)
 * 4. Local development when Supabase branch isn't available
 *
 * Usage:
 *   import { getTestDb, seedTestData, clearTestData } from '../utils/test-db';
 *   const db = getTestDb();
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const DB_DIR = path.join(__dirname, "..", "db");
const DB_PATH = path.join(DB_DIR, "test-environment.db");
const SCHEMA_PATH = path.join(DB_DIR, "test-schema.sql");
const SEED_PATH = path.join(DB_DIR, "seed.sql");

let _db: Database.Database | null = null;

// ─── Database singleton ──────────────────────────────────────────────────────

/**
 * Get or create the test database instance.
 * Runs schema migration on first call.
 */
export function getTestDb(): Database.Database {
  if (_db) return _db;

  // Ensure db directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // Enable WAL mode for concurrent access
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Apply schema
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  _db.exec(schema);

  console.log(`[test-db] Connected: ${DB_PATH}`);
  return _db;
}

/**
 * Close and reset the database connection.
 */
export function closeTestDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Delete and recreate the test database from scratch.
 */
export function resetTestDb(): Database.Database {
  closeTestDb();
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  return getTestDb();
}

// ─── Seed data ───────────────────────────────────────────────────────────────

/**
 * Seed the test database with baseline data (admin, client, sample leads).
 */
export function seedTestData(): void {
  const db = getTestDb();
  const seed = fs.readFileSync(SEED_PATH, "utf-8");

  // Execute each statement (SQLite exec supports multiple statements)
  db.exec(seed);
  console.log("[test-db] Seed data applied");
}

/**
 * Clear all test data (keeps schema intact).
 */
export function clearTestData(): void {
  const db = getTestDb();

  // Order matters — child tables first
  const tables = [
    "client_icebreakers",
    "client_leads",
    "sequence_messages",
    "sequence_executions",
    "sequences",
    "messages",
    "activity_log",
    "apify_sync_log",
    "micro_deliveries",
    "pending_transactions",
    "appointments",
    "client_workspaces",
    "clients",
    "leads",
    "profiles",
  ];

  for (const table of tables) {
    db.exec(`DELETE FROM ${table}`);
  }

  console.log("[test-db] All test data cleared");
}

// ─── Helpers for tests ───────────────────────────────────────────────────────

/**
 * Generate a UUID v4 string (compatible with Supabase UUIDs).
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Get the count of rows in a table. Useful for assertions.
 */
export function getRowCount(table: string, where?: string, params?: unknown[]): number {
  const db = getTestDb();
  const sql = where
    ? `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`
    : `SELECT COUNT(*) as count FROM ${table}`;
  const row = db.prepare(sql).get(...(params ? [params] : [])) as { count: number };
  return row?.count ?? 0;
}

/**
 * Check if a table exists in the test database.
 */
export function tableExists(tableName: string): boolean {
  const db = getTestDb();
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName) as { name: string } | undefined;
  return !!row;
}

// ─── Auto-initialize on import ──────────────────────────────────────────────
// Initialize database when this module is first loaded
getTestDb();
