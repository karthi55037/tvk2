import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { createSubject, listSubjects } from '@/server/services/subjects';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(req);
    return Response.json({ subjects: await listSubjects() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(
      req,
      z.object({
        name: z.string().min(2).max(100),
        code: z.string().min(2).max(20),
        facultyName: z.string().min(2).max(100),
        facultyFloor: z.string().max(20).optional(),
        facultyRoom: z.string().max(20).optional(),
      }),
    );
    return Response.json(await createSubject(actor, input));
  });
}
