import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { postODLetter } from '@/server/services/od';
import { saveFile } from '@/server/files';
import { rateLimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    if (!rateLimit(`upload:${user.id}`, 30, 60 * 60_000)) {
      return Response.json({ error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please try later.' } }, { status: 429 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Attach the completed OD letter file' } }, { status: 400 });
    }
    const saved = await saveFile({ user, file, module: 'OD', entityId: params.id });
    const result = await postODLetter(user, params.id, saved.id);
    return Response.json({ request: result.od, file: saved });
  });
}
