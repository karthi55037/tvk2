import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { markVisitReturned } from '@/server/services/visits';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['REPRESENTATIVE', 'ADVISOR', 'ADMIN']);
    return Response.json({ visit: await markVisitReturned(actor, params.id) });
  });
}
