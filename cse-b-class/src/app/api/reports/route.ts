import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { listReports, reportMessage } from '@/server/services/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['ADVISOR', 'ADMIN']);
    const status = new URL(req.url).searchParams.get('status') || undefined;
    return Response.json({ reports: await listReports(user, status) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req, ['REPRESENTATIVE', 'ADVISOR', 'ADMIN']);
    const input = await body(
      req,
      z.object({
        messageId: z.string(),
        category: z.enum(['ABUSE', 'SPAM', 'INCORRECT', 'PRIVATE_INFO', 'OTHER']),
        description: z.string().max(500).optional(),
      }),
    );
    return Response.json({ report: await reportMessage(actor, input) });
  });
}
