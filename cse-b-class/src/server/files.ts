import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { db, orm } from '@/server/db';
import {
  assignmentResources,
  chatMessages,
  experimentRecords,
  experimentResources,
  fileObjects,
  leaveDocuments,
  leaveRequests,
  odDocuments,
  odRequests,
} from '@/drizzle/schema';
import { ALLOWED_MIME, type FileModule } from '@/lib/constants';
import { ROLES } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { AUDIT, audit } from '@/server/audit';

export function storageDir(): string {
  return path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage');
}

function maxBytes(): number {
  return Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
}

/** Lightweight magic-byte validation for common formats (§35 malware checks where appropriate). */
function magicOk(buf: Buffer, mime: string): boolean {
  const starts = (b: number[]) => b.every((byte, i) => buf[i] === byte);
  if (mime === 'application/pdf') return starts([0x25, 0x50, 0x44, 0x46]);
  if (mime === 'image/png') return starts([0x89, 0x50, 0x4e, 0x47]);
  if (mime === 'image/jpeg') return starts([0xff, 0xd8, 0xff]);
  if (mime === 'image/gif') return starts([0x47, 0x49, 0x46]);
  if (mime === 'application/zip' || /openxmlformats/.test(mime)) return buf.length > 3 && starts([0x50, 0x4b]);
  return true; // text-ish types
}

export async function saveFile(input: {
  user: AuthUser;
  file: File;
  module: FileModule;
  entityId?: string;
}): Promise<{ id: string; fileName: string; sizeBytes: number; mimeType: string }> {
  const { file } = input;
  if (!file || typeof file === 'string') throw ApiError.badRequest('No file provided');
  if (file.size <= 0) throw ApiError.badRequest('File is empty');
  if (file.size > maxBytes()) throw ApiError.payload(`File exceeds the ${process.env.MAX_UPLOAD_MB || 10} MB limit`);
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime)) throw ApiError.badRequest(`File type ${mime} is not allowed`);

  const buf = Buffer.from(await file.arrayBuffer());
  if (!magicOk(buf, mime)) throw ApiError.badRequest('File content does not match its type — upload rejected');

  const fileName = sanitizeName(file.name || 'file');
  const now = new Date();
  const rel = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  const dir = path.join(storageDir(), rel);
  mkdirSync(dir, { recursive: true });
  const storageKey = path.join(rel, `${randomUUID()}_${fileName}`);
  writeFileSync(path.join(storageDir(), storageKey), buf);

  const [row] = await orm
    .insert(fileObjects)
    .values({
      ownerId: input.user.id,
      module: input.module,
      entityId: input.entityId,
      fileName,
      mimeType: mime,
      sizeBytes: buf.length,
      storageKey,
      sha256: createHash('sha256').update(buf).digest('hex'),
    })
    .returning();
  return { id: row.id, fileName, sizeBytes: buf.length, mimeType: mime };
}

function openStorage(storageKey: string): Buffer {
  const base = storageDir();
  const full = path.resolve(base, storageKey);
  if (!full.startsWith(base + path.sep)) throw ApiError.forbidden(); // path traversal guard
  return readFileSync(full);
}

/**
 * File access authorization (§39). Files are NEVER exposed by public URL;
 * every read goes through this server-side check.
 */
export async function authorizeFile(user: AuthUser, fileId: string): Promise<{ row: typeof fileObjects.$inferSelect; buffer: Buffer }> {
  const [row] = await orm.select().from(fileObjects).where(and(eq(fileObjects.id, fileId), isNull(fileObjects.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('File not found');
  const staff = user.role !== ROLES.STUDENT;
  let allowed = false;

  switch (row.module) {
    case 'LEAVE': {
      const [doc] = await orm.select().from(leaveDocuments).where(eq(leaveDocuments.fileId, fileId)).limit(1);
      if (!doc) break;
      const [leave] = await orm.select().from(leaveRequests).where(eq(leaveRequests.id, doc.leaveId)).limit(1);
      allowed = !!leave && (leave.userId === user.id || user.role === ROLES.ADVISOR || user.role === ROLES.REPRESENTATIVE);
      break;
    }
    case 'OD': {
      const [doc] = await orm.select().from(odDocuments).where(eq(odDocuments.fileId, fileId)).limit(1);
      if (!doc) break;
      const [od] = await orm.select().from(odRequests).where(eq(odRequests.id, doc.odId)).limit(1);
      allowed = !!od && (od.userId === user.id || user.role === ROLES.ADVISOR || user.role === ROLES.REPRESENTATIVE);
      break;
    }
    case 'ASSIGNMENT': {
      const [res] = await orm.select().from(assignmentResources).where(eq(assignmentResources.fileId, fileId)).limit(1);
      if (!res) break;
      allowed = res.status === 'APPROVED' || res.uploaderId === user.id || (staff && res.status === 'PENDING');
      break;
    }
    case 'EXPERIMENT': {
      const [rec] = await orm.select().from(experimentRecords).where(eq(experimentRecords.fileId, fileId)).limit(1);
      if (rec) {
        allowed = rec.userId === user.id || staff;
        break;
      }
      const [res] = await orm.select().from(experimentResources).where(eq(experimentResources.fileId, fileId)).limit(1);
      if (res) {
        allowed = res.status === 'APPROVED' || res.uploaderId === user.id || (staff && res.status === 'PENDING');
      }
      break;
    }
    case 'CHAT':
      allowed = true; // class members only reach this with a valid session
      break;
    case 'ANNOUNCEMENT':
      allowed = true;
      break;
    case 'IMPORT':
      allowed = user.role === ROLES.ADVISOR || user.role === ROLES.ADMIN;
      break;
    default:
      allowed = false;
  }
  if (!allowed) {
    await audit({ actor: user, action: 'FILE_ACCESS_DENIED', targetType: 'file', targetId: fileId });
    throw ApiError.forbidden('You do not have access to this file');
  }
  // Audit private document access (letters)
  if (row.module === 'LEAVE' || row.module === 'OD') {
    await audit({ actor: user, action: AUDIT.PRIVATE_FILE_OPENED, targetType: row.module, targetId: fileId });
  }
  const buffer = openStorage(row.storageKey);
  return { row, buffer };
}

export async function fileMeta(fileId: string) {
  const [row] = await orm.select().from(fileObjects).where(and(eq(fileObjects.id, fileId), isNull(fileObjects.deletedAt))).limit(1);
  return row || null;
}

export function fileResponse(row: typeof fileObjects.$inferSelect, buffer: Buffer, download: boolean) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': row.mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${row.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
