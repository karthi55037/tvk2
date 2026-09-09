import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { saveFile } from '@/server/files';
import { rateLimit } from '@/server/ratelimit';
import { AUDIT, audit } from '@/server/audit';

export const dynamic = 'force-dynamic';

/**
 * Secure upload endpoint (§39). Files are stored outside the database and are
 * only ever served back through the authorized /api/files/[id] route.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    if (!rateLimit(`upload:${user.id}`, 30, 60 * 60_000)) {
      return Response.json({ error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please try later.' } }, { status: 429 });
    }
    const form = await req.formData();
    const file = form.get('file');
    const module = z.enum(['LEAVE', 'OD', 'ASSIGNMENT', 'EXPERIMENT', 'CHAT', 'ANNOUNCEMENT', 'IMPORT']).parse(form.get('module'));
    const entityId = (form.get('entityId') as string) || undefined;
    if (!(file instanceof File)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'No file provided' } }, { status: 400 });
    }
    const saved = await saveFile({ user, file, module, entityId });
    await audit({ actor: user, action: AUDIT.FILE_UPLOADED, targetType: 'file', targetId: saved.id, metadata: { module, size: saved.sizeBytes } });
    return Response.json({ file: saved });
  });
}
