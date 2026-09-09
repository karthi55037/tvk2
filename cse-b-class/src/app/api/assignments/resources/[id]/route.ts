import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { removeResource, verifyResource } from '@/server/services/assignments';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    const input = await body(req, z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().max(300).optional() }));
    return Response.json({ resource: await verifyResource(actor, params.id, input.decision, input.note) });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req);
    return Response.json(await removeResource(actor, params.id));
  });
}
