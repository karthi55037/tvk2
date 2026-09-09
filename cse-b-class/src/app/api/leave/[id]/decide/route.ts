import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { decideLeave } from '@/server/services/leave';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR']);
    const input = await body(req, z.object({ decision: z.enum(['APPROVE', 'REJECT']), note: z.string().max(500).optional() }));
    return Response.json({ request: await decideLeave(actor, params.id, input.decision, input.note) });
  });
}
