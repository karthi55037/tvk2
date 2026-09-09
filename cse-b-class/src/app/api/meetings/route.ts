import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { createMeetingRequest, listMeetingsFor } from '@/server/services/users';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ meetings: await listMeetingsFor(user) }); // students: only their own (§30)
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR']);
    const input = await body(
      req,
      z.object({
        studentId: z.string(),
        message: z.string().min(2).max(1000),
        date: z.string().optional(),
        time: z.string().optional(),
        location: z.string().max(120).optional(),
        reason: z.string().max(500).optional(),
      }),
    );
    return Response.json({ meeting: await createMeetingRequest(actor, input) });
  });
}
