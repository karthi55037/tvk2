import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getSubmissions, setSubmission } from '@/server/services/assignments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json(await getSubmissions(user, params.id));
  });
}

/** { status, userId? } — omit userId to mark yourself; reps/advisor/admin may target any student. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(
      req,
      z.object({
        status: z.enum(['SUBMITTED', 'NOT_SUBMITTED']),
        userId: z.string().optional(),
      }),
    );
    return Response.json({ submission: await setSubmission(actor, params.id, input.userId || actor.id, input.status) });
  });
}
