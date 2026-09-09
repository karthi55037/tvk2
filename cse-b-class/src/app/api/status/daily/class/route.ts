import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { getClassDailyStatus } from '@/server/services/status';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE']);
    const date = new URL(req.url).searchParams.get('date');
    return Response.json({ statuses: await getClassDailyStatus(user, date || '') });
  });
}
