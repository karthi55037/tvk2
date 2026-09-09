import { createClient } from '@libsql/client';
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

// One DB per test process (vitest runs each file in its own fork) — isolated & parallel-safe.
const TEST_DB = path.resolve(process.cwd(), `test-${process.pid}.db`);
if (existsSync(TEST_DB)) rmSync(TEST_DB);

process.env.DATABASE_URL = 'file:' + TEST_DB;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-000';
process.env.APP_TZ = 'Asia/Kolkata';
process.env.STORAGE_DIR = './storage-test';
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

// Apply drizzle migrations to the fresh test DB
const migrationsDir = path.resolve(process.cwd(), 'drizzle/migrations');
const journal = JSON.parse(readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'));
const db = createClient({ url: process.env.DATABASE_URL });
await db.execute(`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" ("id" integer PRIMARY KEY AUTOINCREMENT, "hash" text NOT NULL, "created_at" numeric)`);
for (const entry of journal.entries) {
  const sql = readFileSync(path.join(migrationsDir, entry.tag + '.sql'), 'utf8');
  await db.executeMultiple(sql);
}
void readdirSync;
