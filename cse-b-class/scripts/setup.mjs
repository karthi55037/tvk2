#!/usr/bin/env node
/**
 * CSE B Class — one-time setup.
 * 1. Creates .env with generated secrets (JWT secret, VAPID push keys) if missing.
 * 2. Runs prisma migrate deploy + generate.
 * 3. Optionally seeds demo data (pass --seed).
 */
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const envPath = path.join(root, '.env');

let vapidPublic = '', vapidPrivate = '';
try {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  vapidPublic = publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
  vapidPrivate = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64url');
} catch { /* push optional */ }

if (!existsSync(envPath)) {
  const env = [
    `DATABASE_URL="file:./dev.db"`,
    `JWT_SECRET="${randomBytes(32).toString('hex')}"`,
    `APP_TZ="Asia/Kolkata"`,
    `STORAGE_DIR="./storage"`,
    `MAX_UPLOAD_MB="10"`,
    `APP_ORIGIN="http://localhost:3000"`,
    `VAPID_PUBLIC_KEY="${vapidPublic}"`,
    `VAPID_PRIVATE_KEY="${vapidPrivate}"`,
    `VAPID_SUBJECT="mailto:admin@cseb.example.edu"`,
    '',
  ].join('\n');
  writeFileSync(envPath, env);
  console.log('✔ Created .env with generated secrets');
} else {
  console.log('• .env already exists — kept');
  if (!readFileSync(envPath, 'utf8').includes('VAPID_PUBLIC_KEY="') || /VAPID_PUBLIC_KEY=""/.test(readFileSync(envPath, 'utf8'))) {
    // add vapid keys if empty
    let txt = readFileSync(envPath, 'utf8');
    txt = txt.replace(/VAPID_PUBLIC_KEY=""/, `VAPID_PUBLIC_KEY="${vapidPublic}"`)
             .replace(/VAPID_PRIVATE_KEY=""/, `VAPID_PRIVATE_KEY="${vapidPrivate}"`);
    writeFileSync(envPath, txt);
  }
}

console.log('• Applying database migrations…');
execSync('node scripts/migrate.mjs', { cwd: root, stdio: 'inherit', env: { ...process.env } });

if (process.argv.includes('--seed')) {
  console.log('• Seeding database…');
  execSync('node prisma/seed.mjs', { cwd: root, stdio: 'inherit', env: { ...process.env } });
}

console.log('\nSetup complete. Next: npm run dev  (or npm run db:seed for demo data)');
