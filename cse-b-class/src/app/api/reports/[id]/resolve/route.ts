import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { resolveReport } from '@/server/services/chat';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'ADMIN']);
    const input = await body(req, z.object({ outcome: z.enum(['RESOLVED', 'DISMISSED']), note: z.string().max(500).optional() }));
    return Response.json({ report: await resolveReport(actor, params.id, input.outcome, input.note) });
  });
}
