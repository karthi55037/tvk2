import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { addExpResource, listExpResources, verifyExpResource } from '@/server/services/experiments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ resources: await listExpResources(user, params.id) });
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(
      req,
      z.object({
        kind: z.enum(['FILE', 'LINK']),
        title: z.string().min(1).max(150),
        url: z.string().max(1000).optional(),
        fileId: z.string().optional(),
        verifyResourceId: z.string().optional(),
        decision: z.enum(['APPROVED', 'REJECTED']).optional(),
        note: z.string().max(300).optional(),
      }),
    );
    if (input.verifyResourceId) {
      // verification action
      const actor2 = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
      return Response.json({ resource: await verifyExpResource(actor2, input.verifyResourceId, input.decision || 'APPROVED', input.note) });
    }
    return Response.json({ resource: await addExpResource(actor, params.id, input) });
  });
}
