import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { roleSummary } from '@/server/services/roles';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(req);
    return Response.json(await roleSummary());
  });
}
