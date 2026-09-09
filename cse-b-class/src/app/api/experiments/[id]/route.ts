import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { deleteExperiment, getExperiment, updateExperiment } from '@/server/services/experiments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireUser(req);
    return Response.json({ experiment: await getExperiment(params.id) });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    const input = await body(
      req,
      z.object({
        name: z.string().min(2).max(150).optional(),
        details: z.string().max(5000).optional(),
        instructions: z.string().max(5000).optional(),
        requiredFilesNote: z.string().max(500).nullish(),
        number: z.number().int().min(1).max(100).optional(),
      }),
    );
    return Response.json(await updateExperiment(actor, params.id, input));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    return Response.json(await deleteExperiment(actor, params.id));
  });
}
