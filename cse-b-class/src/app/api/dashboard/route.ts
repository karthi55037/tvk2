import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { studentDashboard } from '@/server/services/dashboard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json(await studentDashboard(user));
  });
}
