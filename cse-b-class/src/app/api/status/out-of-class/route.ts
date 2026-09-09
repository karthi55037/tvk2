import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getMyActiveOut, listOutOfClass, markOutOfClass } from '@/server/services/status';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const activeOnly = new URL(req.url).searchParams.get('active') === '1';
    const [records, mine] = await Promise.all([listOutOfClass(user, { activeOnly }), getMyActiveOut(user)]);
    return Response.json({ records, mine });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(
      req,
      z.object({
        destination: z.string().min(2).max(120),
        reason: z.string().min(2).max(500), // private — visible only to Advisor + Reps (§11)
        expectedReturnAt: z.string(), // ISO timestamp
      }),
    );
    return Response.json({ record: await markOutOfClass(user, input) });
  });
}
