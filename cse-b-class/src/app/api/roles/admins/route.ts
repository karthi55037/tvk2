import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { addAdmin, getAdmins } from '@/server/services/roles';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADMIN']);
    void actor;
    return Response.json({ admins: await getAdmins() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADMIN']);
    const input = await body(
      req,
      z.object({ name: z.string().min(2).max(80), username: z.string().min(3).max(64), tempPassword: z.string().min(8).max(64).optional() }),
    );
    return Response.json(await addAdmin(actor, input));
  });
}
