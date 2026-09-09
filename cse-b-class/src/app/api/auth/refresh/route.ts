import { handle } from '@/lib/api';
import { rotateRefresh, setAuthCookies } from '@/server/auth';
import { ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const rotated = await rotateRefresh(req);
    if (!rotated) throw ApiError.unauthorized('Session expired. Please sign in again.');
    const headers = new Headers({ 'Content-Type': 'application/json' });
    setAuthCookies(headers, rotated.access, rotated.refresh);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  });
}
