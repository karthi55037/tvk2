import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { markRead } from '@/server/services/announcements';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json(await markRead(user, params.id));
  });
}
