import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { consoleOverview } from '@/server/services/dashboard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    return Response.json(await consoleOverview());
  });
}
