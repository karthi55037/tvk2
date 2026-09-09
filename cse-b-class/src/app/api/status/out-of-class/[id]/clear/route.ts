import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { clearOutStatus } from '@/server/services/status';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE']);
    return Response.json({ record: await clearOutStatus(user, params.id) });
  });
}
