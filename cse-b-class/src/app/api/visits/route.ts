import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { createVisit, listVisits } from '@/server/services/visits';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ visits: await listVisits(user) }); // students see only their own (§29)
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req, ['REPRESENTATIVE', 'ADVISOR', 'ADMIN']);
    const input = await body(
      req,
      z.object({
        studentId: z.string(),
        teacherName: z.string().min(2).max(100),
        location: z.string().min(2).max(120),
        reason: z.string().min(2).max(500),
        outAt: z.string(), // ISO
        expectedReturnAt: z.string(), // ISO
      }),
    );
    return Response.json({ visit: await createVisit(actor, input) });
  });
}
