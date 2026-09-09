import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { deleteItem, getItem, updateItem } from '@/server/services/assignments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ item: await getItem(user, params.id) });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    const input = await body(
      req,
      z.object({
        title: z.string().min(2).max(150).optional(),
        instructions: z.string().max(5000).optional(),
        deadline: z.string().nullish(),
        requiredFilesNote: z.string().max(500).nullish(),
      }),
    );
    return Response.json(await updateItem(actor, params.id, input));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    return Response.json(await deleteItem(actor, params.id));
  });
}
