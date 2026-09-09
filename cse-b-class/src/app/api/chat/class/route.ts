import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { listMessages, postMessage } from '@/server/services/chat';
import { CLASS_THREAD } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const ref = { threadType: 'CLASS' as const, threadId: CLASS_THREAD };

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const after = new URL(req.url).searchParams.get('after') || undefined;
    return Response.json({ messages: await listMessages(user, ref, after) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(req, z.object({ body: z.string().max(2000).optional(), fileId: z.string().optional() }));
    return Response.json({ message: await postMessage(user, ref, input) });
  });
}
