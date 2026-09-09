import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { addRepresentative } from '@/server/services/roles';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(req, z.object({ userId: z.string().min(1) }));
    return Response.json(await addRepresentative(actor, input.userId));
  });
}
