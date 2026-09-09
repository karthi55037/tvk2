import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { addResource, listResources } from '@/server/services/assignments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ resources: await listResources(user, params.id) });
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
      }),
    );
    return Response.json({ resource: await addResource(actor, params.id, input) });
  });
}
