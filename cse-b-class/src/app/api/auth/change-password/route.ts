import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { changeOwnPassword } from '@/server/services/users';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, undefined, { allowPasswordChange: true });
    const input = await body(req, z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) }));
    await changeOwnPassword(user, input.currentPassword, input.newPassword);
    return Response.json({ ok: true });
  });
}
