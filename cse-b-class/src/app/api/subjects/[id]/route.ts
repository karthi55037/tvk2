import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { removeSubject, updateSubject } from '@/server/services/subjects';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(
      req,
      z.object({
        name: z.string().min(2).max(100).optional(),
        code: z.string().min(2).max(20).optional(),
        facultyName: z.string().min(2).max(100).optional(),
        facultyFloor: z.string().max(20).optional(),
        facultyRoom: z.string().max(20).optional(),
      }),
    );
    return Response.json(await updateSubject(actor, params.id, input));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req);
    return Response.json(await removeSubject(actor, params.id));
  });
}
