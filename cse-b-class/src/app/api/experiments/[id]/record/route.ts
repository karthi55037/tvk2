import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getMyRecord, uploadRecord, verifyRecord } from '@/server/services/experiments';
import { saveFile } from '@/server/files';
import { rateLimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ record: await getMyRecord(user, params.id) });
  });
}

/** Student uploads their record file (multipart). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    if (!rateLimit(`upload:${user.id}`, 30, 60 * 60_000)) {
      return Response.json({ error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please try later.' } }, { status: 429 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Attach your record file' } }, { status: 400 });
    }
    const note = (form.get('note') as string) || undefined;
    const saved = await saveFile({ user, file, module: 'EXPERIMENT', entityId: params.id });
    return Response.json({ record: await uploadRecord(user, params.id, saved.id, note) });
  });
}

/** Verify a student's record file: POST { studentId, decision, note } (any ONE verifier). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['REPRESENTATIVE', 'ADVISOR', 'ADMIN']);
    const input = await body(
      req,
      z.object({
        studentId: z.string(),
        decision: z.enum(['VERIFIED', 'REJECTED']),
        note: z.string().max(300).optional(),
      }),
    );
    return Response.json({ record: await verifyRecord(actor, params.id, input.studentId, input.decision, input.note) });
  });
}
