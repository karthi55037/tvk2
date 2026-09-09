import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { postLeaveLetter } from '@/server/services/leave';
import { saveFile } from '@/server/files';
import { clientIp, rateLimit } from '@/server/ratelimit';

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
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Attach the signed leave letter file' } }, { status: 400 });
    }
    const saved = await saveFile({ user, file, module: 'LEAVE', entityId: params.id });
    const result = await postLeaveLetter(user, params.id, saved.id);
    void clientIp;
    return Response.json({ request: result.leave, file: saved });
  });
}
