import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { createClearingRequest, listClearingRequests } from '@/server/services/clearing';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    return Response.json({ requests: await listClearingRequests(user) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    const input = await body(
      req,
      z.object({
        scope: z.enum(['CLASS_CHAT_MESSAGE', 'CLASS_CHAT_FILE']),
        targetId: z.string(),
        reason: z.string().min(3).max(500),
      }),
    );
    return Response.json({ request: await createClearingRequest(actor, input) });
  });
}
