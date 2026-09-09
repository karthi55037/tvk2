import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { approveClearing } from '@/server/services/clearing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    const input = await body(req, z.object({ note: z.string().max(300).optional() })).catch(() => ({ note: undefined }));
    return Response.json({ request: await approveClearing(actor, params.id, input.note) });
  });
}
