import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { closeMeeting } from '@/server/services/users';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'ADMIN']);
    return Response.json({ meeting: await closeMeeting(actor, params.id) });
  });
}
