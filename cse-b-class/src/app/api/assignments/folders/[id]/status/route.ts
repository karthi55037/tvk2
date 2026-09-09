import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { setFolderStatus } from '@/server/services/assignments';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    const input = await body(req, z.object({ status: z.enum(['ACTIVE', 'COMPLETED']) }));
    return Response.json({ folder: await setFolderStatus(actor, params.id, input.status) });
  });
}
