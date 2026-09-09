import { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { orm } from '@/server/db';
import { auditLogs } from '@/drizzle/schema';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['ADVISOR', 'ADMIN']);
    void user;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const limit = Math.min(Number(url.searchParams.get('limit') || 200), 500);
    const rows = await orm
      .select()
      .from(auditLogs)
      .where(action ? eq(auditLogs.action, action) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    return Response.json({ logs: rows });
  });
}
