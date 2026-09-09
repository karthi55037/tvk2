/**
 * Applies drizzle-kit SQL migrations to the database configured by DATABASE_URL.
 * Works with @libsql/client (file: or remote libsql/turso URLs) — no native build tools needed.
 */
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const migrationsDir = path.resolve(process.cwd(), 'drizzle/migrations');

if (!existsSync(path.join(migrationsDir, 'meta/_journal.json'))) {
  console.log('No migrations found — nothing to apply.');
  process.exit(0);
}

const journal = JSON.parse(readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'));
const db = createClient({ url });

await db.execute(`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "hash" text NOT NULL,
  "created_at" numeric
)`);

const applied = await db.execute('SELECT hash FROM "__drizzle_migrations"');
const norm = (v) => String(Number(v));
const appliedHashes = new Set(applied.rows.map((r) => norm(r.hash)));

for (const entry of journal.entries) {
  if (appliedHashes.has(norm(entry.idx))) continue;
  const file = path.join(migrationsDir, entry.tag + '.sql');
  const sql = readFileSync(file, 'utf8');
  console.log('• Applying', entry.tag);
  await db.executeMultiple(sql);
  await db.execute({ sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)', args: [String(entry.idx), Date.now()] });
}
console.log('✔ Migrations up to date.');
