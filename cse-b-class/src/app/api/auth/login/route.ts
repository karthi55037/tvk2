import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { login } from '@/server/services/authService';
import { setAuthCookies } from '@/server/auth';
import { clientIp } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const input = await body(
      req,
      z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) }),
    );
    const result = await login({
      username: input.username,
      password: input.password,
      userAgent: req.headers.get('user-agent') || undefined,
      ip: clientIp(req),
    });
    const res = Response.json({ user: result.user, mustChangePassword: result.user.mustChangePassword });
    // Attach cookies to the response
    const headers = new Headers(res.headers);
    setAuthCookies(headers, result.tokens.access, result.tokens.refresh);
    return new Response(res.body, { status: res.status, headers });
  });
}
