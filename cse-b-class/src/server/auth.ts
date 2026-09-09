import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db, orm } from '@/server/db';
import { sessions, users } from '@/drizzle/schema';
import { ROLES, type Role } from '@/lib/constants';
import { ApiError } from '@/lib/api';

export const ACCESS_COOKIE = 'cb_access';
export const REFRESH_COOKIE = 'cb_refresh';
const ACCESS_TTL_SEC = 60 * 15; // 15 minutes
const REFRESH_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export type AuthUser = {
  id: string;
  username: string;
  regNo: string | null;
  role: Role;
  name: string;
  mustChangePassword: boolean;
};

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    // Dev fallback so a fresh clone boots; setup script always writes a real secret.
    return new TextEncoder().encode('insecure-dev-secret-change-me-please000000');
  }
  return new TextEncoder().encode(s);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 11);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

async function signToken(payload: Record<string, unknown>, ttlSec: number, typ: string) {
  return new SignJWT({ ...payload, typ })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(secret());
}

export async function createSession(userId: string, userAgent?: string, ip?: string) {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  const [session] = await orm.insert(sessions).values({ userId, expiresAt, userAgent, ip }).returning();
  return session;
}

export async function issueTokens(user: { id: string; role: string }, sessionId: string) {
  const access = await signToken({ sub: user.id, sid: sessionId, role: user.role }, ACCESS_TTL_SEC, 'access');
  const refresh = await signToken({ sub: user.id, sid: sessionId }, REFRESH_TTL_SEC, 'refresh');
  return { access, refresh };
}

export function cookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    path: '/',
    maxAge: maxAgeSec,
  };
}

export function setAuthCookies(headers: Headers, access: string, refresh: string) {
  // Headers-based cookie set (works in route handlers)
  const opts = (name: string, v: string, maxAge: number) =>
    `${name}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
      process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false' ? '; Secure' : ''
    }`;
  headers.append('Set-Cookie', opts(ACCESS_COOKIE, access, ACCESS_TTL_SEC));
  headers.append('Set-Cookie', opts(REFRESH_COOKIE, refresh, REFRESH_TTL_SEC));
}

export function clearAuthCookies(headers: Headers) {
  const opts = (name: string) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
    process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false' ? '; Secure' : ''
  }`;
  headers.append('Set-Cookie', opts(ACCESS_COOKIE));
  headers.append('Set-Cookie', opts(REFRESH_COOKIE));
}

async function loadUser(userId: string): Promise<AuthUser | null> {
  const [u] = await orm
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt), eq(users.isActive, true)))
    .limit(1);
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    regNo: u.regNo,
    role: u.role as Role,
    name: u.name,
    mustChangePassword: u.mustChangePassword,
  };
}

/** Verify access token + server-side session. Returns null when invalid. */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ACCESS_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], secret());
    if (payload.typ !== 'access') return null;
    const sessionId = String(payload.sid);
    const [session] = await orm
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!session) return null;
    return await loadUser(String(payload.sub));
  } catch {
    return null;
  }
}

/** Rotate: verify refresh token -> new pair. */
export async function rotateRefresh(req: Request): Promise<{ userId: string; access: string; refresh: string } | null> {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], secret());
    if (payload.typ !== 'refresh') return null;
    const sessionId = String(payload.sid);
    const [session] = await orm
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!session) return null;
    const user = await loadUser(String(payload.sub));
    if (!user) return null;
    // sliding expiration
    await orm.update(sessions).set({ expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000) }).where(eq(sessions.id, sessionId));
    const tokens = await issueTokens(user, sessionId);
    return { userId: user.id, ...tokens };
  } catch {
    return null;
  }
}

export async function destroySession(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]+)`));
  if (!match) return;
  try {
    const { payload } = await jwtVerify(match[1], secret());
    await orm.delete(sessions).where(eq(sessions.id, String(payload.sid)));
  } catch {
    /* token already invalid */
  }
}

/** Route guard: authenticates, optionally restricts roles, enforces forced password change (§8). */
export async function requireUser(req: Request, roles?: Role[], opts: { allowPasswordChange?: boolean } = {}): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) throw ApiError.unauthorized();
  if (!opts.allowPasswordChange && user.mustChangePassword) {
    throw new ApiError(403, 'PASSWORD_CHANGE_REQUIRED', 'Please change your initial password first.');
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw ApiError.forbidden();
  }
  return user;
}
