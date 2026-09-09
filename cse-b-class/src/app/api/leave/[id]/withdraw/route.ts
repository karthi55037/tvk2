import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { resolveWithdrawal, withdrawLeave } from '@/server/services/leave';
import { body as parseBody } from '@/lib/api';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ request: await withdrawLeave(user, params.id) });
  });
}

/** Advisor resolves a withdrawal request on an approved leave. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR']);
    const input = await parseBody(req, z.object({ approve: z.boolean() }));
    return Response.json({ request: await resolveWithdrawal(actor, params.id, input.approve) });
  });
}
