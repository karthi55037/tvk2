import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getCompletions, setCompletion } from '@/server/services/experiments';

export const dynamic = 'force-dynamic';

/** POST { status, userId? } — students mark themselves; reps/staff can set any. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(
      req,
      z.object({ status: z.enum(['COMPLETED', 'NOT_COMPLETED']), userId: z.string().optional() }),
    );
    return Response.json({ completion: await setCompletion(actor, params.id, input.userId || actor.id, input.status) });
  });
}

/** Full class completion + verification board (visible to staff for management). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ completions: await getCompletions(user, params.id) });
  });
}
