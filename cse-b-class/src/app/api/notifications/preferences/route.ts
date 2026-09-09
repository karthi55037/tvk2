import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getPreferences, setPreferences } from '@/server/notify';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ preferences: await getPreferences(user.id) });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(req, z.object({ preferences: z.record(z.boolean()) }));
    const saved = await setPreferences(user.id, input.preferences);
    return Response.json({ preferences: saved });
  });
}
