import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getMyDailyStatus, setDailyStatus } from '@/server/services/status';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ statuses: await getMyDailyStatus(user) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(
      req,
      z.object({
        date: z.string(),
        status: z.enum(['PRESENT', 'NOT_COMING', 'LATE', 'HALF_DAY']),
        reason: z.string().max(500).optional(),
        halfDayPart: z.enum(['FIRST', 'SECOND']).optional(),
        halfDayTime: z.string().max(20).optional(),
      }),
    );
    return Response.json({ status: await setDailyStatus(user, input) });
  });
}
