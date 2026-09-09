import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { listNotifications, markAllRead } from '@/server/notify';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ notifications: await listNotifications(user.id) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    await markAllRead(user.id);
    return Response.json({ ok: true });
  });
}
