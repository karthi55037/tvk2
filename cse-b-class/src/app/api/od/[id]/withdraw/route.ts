import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { resolveODWithdrawal, withdrawOD } from '@/server/services/od';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ request: await withdrawOD(user, params.id) });
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR']);
    const input = await body(req, z.object({ approve: z.boolean() }));
    return Response.json({ request: await resolveODWithdrawal(actor, params.id, input.approve) });
  });
}
