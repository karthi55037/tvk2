import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { listODs, submitOD } from '@/server/services/od';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const mine = new URL(req.url).searchParams.get('mine') === '1';
    return Response.json({ requests: await listODs(user, { mineOnly: mine }) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(
      req,
      z.object({
        programName: z.string().min(2).max(150),
        place: z.string().min(2).max(150),
        date: z.string(),
        fromTime: z.string(),
        toTime: z.string(),
        reason: z.string().min(2).max(1000),
      }),
    );
    return Response.json({ request: await submitOD(user, input) });
  });
}
