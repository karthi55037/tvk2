import { and, eq, isNull, gt } from 'drizzle-orm';
import { orm } from '@/server/db';
import { users } from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import { createSession, issueTokens, verifyPassword, type AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { rateLimit, clientIp } from '@/server/ratelimit';

/** Login (§8): students use Register Number + initial DOB password; staff use their staff id. */
export async function login(input: { username: string; password: string; userAgent?: string; ip?: string }) {
  const username = input.username.trim();
  const ip = input.ip || 'local';
  if (!rateLimit(`login:${ip}`, 12, 5 * 60_000)) {
    throw ApiError.tooMany('Too many login attempts. Please wait a few minutes and try again.');
  }
  const [user] = await orm
    .select()
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);
  if (!user || !user.isActive) {
    await audit({ action: AUDIT.LOGIN_FAILED, targetType: 'user', metadata: { username }, ip });
    // Same message for unknown user and wrong password (no user enumeration)
    throw ApiError.unauthorized('Invalid username or password');
  }
  if (!verifyPassword(input.password, user.passwordHash)) {
    await audit({ actor: { id: user.id, username: user.username, regNo: user.regNo, role: user.role as never, name: user.name, mustChangePassword: user.mustChangePassword }, action: AUDIT.LOGIN_FAILED, targetType: 'user', targetId: user.id, ip });
    throw ApiError.unauthorized('Invalid username or password');
  }
  const session = await createSession(user.id, input.userAgent, ip);
  const tokens = await issueTokens(user, session.id);
  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    regNo: user.regNo,
    role: user.role as AuthUser['role'],
    name: user.name,
    mustChangePassword: user.mustChangePassword,
  };
  await audit({ actor: authUser, action: AUDIT.LOGIN, targetType: 'session', targetId: session.id, ip });
  return { user: authUser, tokens };
}
