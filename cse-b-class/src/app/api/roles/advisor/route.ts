import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { setAdvisor, removeAdvisor } from '@/server/services/roles';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(
      req,
      z.object({
        name: z.string().min(2).max(80),
        username: z.string().min(3).max(64),
        tempPassword: z.string().min(8).max(64).optional(),
        email: z.string().email().optional(),
      }),
    );
    return Response.json(await setAdvisor(actor, input));
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const actor = await requireUser(req);
    return Response.json(await removeAdvisor(actor));
  });
}
