import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { listLeaves, submitLeave } from '@/server/services/leave';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const mine = new URL(req.url).searchParams.get('mine') === '1';
    return Response.json({ requests: await listLeaves(user, { mineOnly: mine }) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(
      req,
      z.object({
        fromDate: z.string(),
        toDate: z.string(),
        reason: z.string().min(2).max(1000),
        contact: z.string().max(20).optional(),
      }),
    );
    return Response.json({ request: await submitLeave(user, input) });
  });
}
