import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { markBack } from '@/server/services/status';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ record: await markBack(user) });
  });
}
