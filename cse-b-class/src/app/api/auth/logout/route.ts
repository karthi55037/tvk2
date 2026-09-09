import { handle } from '@/lib/api';
import { getAuthUser, destroySession, clearAuthCookies } from '@/server/auth';
import { audit, AUDIT } from '@/server/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthUser(req);
    await destroySession(req);
    if (user) await audit({ actor: user, action: AUDIT.LOGOUT, targetType: 'session' });
    const headers = new Headers();
    clearAuthCookies(headers);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers.entries()) } });
  });
}
