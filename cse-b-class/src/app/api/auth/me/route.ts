import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req, undefined, { allowPasswordChange: true });
    return Response.json({ user });
  });
}
