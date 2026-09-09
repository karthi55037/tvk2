import { and, asc, eq, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { users } from '@/drizzle/schema';
import { MAX_REPRESENTATIVES, ROLES, AUDIT, type Role } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { hashPassword } from '@/server/auth';
import { audit } from '@/server/audit';

async function activeCount(role: Role): Promise<number> {
  const rows = await orm.select({ id: users.id }).from(users).where(and(eq(users.role, role), isNull(users.deletedAt), eq(users.isActive, true)));
  return rows.length;
}

export async function getActiveAdvisor() {
  const [advisor] = await orm
    .select({ id: users.id, name: users.name, username: users.username, email: users.email })
    .from(users)
    .where(and(eq(users.role, ROLES.ADVISOR), isNull(users.deletedAt), eq(users.isActive, true)))
    .limit(1);
  return advisor || null;
}

export async function getRepresentatives() {
  return orm
    .select({ id: users.id, name: users.name, regNo: users.regNo, username: users.username })
    .from(users)
    .where(and(eq(users.role, ROLES.REPRESENTATIVE), isNull(users.deletedAt), eq(users.isActive, true)))
    .orderBy(asc(users.name));
}

export async function getAdmins() {
  return orm
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(and(eq(users.role, ROLES.ADMIN), isNull(users.deletedAt), eq(users.isActive, true)))
    .orderBy(asc(users.username));
}

export async function roleSummary() {
  const [advisor, reps, admins] = await Promise.all([getActiveAdvisor(), getRepresentatives(), getAdmins()]);
  return { advisor, representatives: reps, admins };
}

/** Add a representative (§7): Advisor, Admin or an existing Representative; cap 4; target must be a student. */
export async function addRepresentative(actor: AuthUser, userId: string) {
  if (!actor) throw ApiError.unauthorized();
  if (!(actor.role === ROLES.ADVISOR || actor.role === ROLES.ADMIN || actor.role === ROLES.REPRESENTATIVE)) throw ApiError.forbidden();
  const [target] = await orm.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  if (!target) throw ApiError.notFound('User not found');
  if (target.role !== ROLES.STUDENT) throw ApiError.badRequest('Only students can become representatives');
  if ((await activeCount(ROLES.REPRESENTATIVE)) >= MAX_REPRESENTATIVES) {
    throw ApiError.conflict(`Class can have at most ${MAX_REPRESENTATIVES} representatives`);
  }
  await orm.update(users).set({ role: ROLES.REPRESENTATIVE, updatedAt: new Date() }).where(eq(users.id, userId));
  await audit({ actor, action: AUDIT.ROLE_REP_ADDED, targetType: 'user', targetId: userId });
  return { id: userId, name: target.name };
}

/** Remove a representative (§7): Advisor, Admin or another Representative (not themselves). */
export async function removeRepresentative(actor: AuthUser, userId: string) {
  if (!(actor.role === ROLES.ADVISOR || actor.role === ROLES.ADMIN || actor.role === ROLES.REPRESENTATIVE)) throw ApiError.forbidden();
  if (actor.role === ROLES.REPRESENTATIVE && actor.id === userId) {
    throw ApiError.badRequest('Representatives cannot remove themselves — ask the Advisor or another representative');
  }
  const [target] = await orm.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  if (!target || target.role !== ROLES.REPRESENTATIVE) throw ApiError.badRequest('User is not a representative');
  await orm.update(users).set({ role: ROLES.STUDENT, updatedAt: new Date() }).where(eq(users.id, userId));
  await audit({ actor, action: AUDIT.ROLE_REP_REMOVED, targetType: 'user', targetId: userId });
  return { id: userId };
}

/** Set the Class Advisor (§7): Representatives or Admins. Max 1 advisor. Creates the advisor account if needed. */
export async function setAdvisor(actor: AuthUser, input: { name: string; username: string; tempPassword?: string; email?: string }) {
  if (actor.role !== ROLES.REPRESENTATIVE && actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only Representatives or App Administrators can assign the Class Advisor');
  }
  if ((await activeCount(ROLES.ADVISOR)) >= 1) throw ApiError.conflict('A Class Advisor already exists — remove them first');
  const username = input.username.trim();
  if (username.length < 3) throw ApiError.badRequest('Advisor username must be at least 3 characters');
  const [existing] = await orm.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) throw ApiError.conflict('That username is already taken');
  const temp = input.tempPassword && input.tempPassword.length >= 8 ? input.tempPassword : 'Advisor@' + Math.floor(1000 + Math.random() * 9000);
  const [row] = await orm
    .insert(users)
    .values({
      username,
      name: input.name.trim(),
      email: input.email,
      role: ROLES.ADVISOR,
      passwordHash: hashPassword(temp),
      mustChangePassword: true,
    })
    .returning();
  await audit({ actor, action: AUDIT.ROLE_ADVISOR_SET, targetType: 'user', targetId: row.id });
  return { id: row.id, temporaryPassword: temp };
}

/** Remove the Class Advisor (§7): Representatives or Admins. */
export async function removeAdvisor(actor: AuthUser) {
  if (actor.role !== ROLES.REPRESENTATIVE && actor.role !== ROLES.ADMIN) throw ApiError.forbidden();
  const advisor = await getActiveAdvisor();
  if (!advisor) throw ApiError.badRequest('No Class Advisor exists');
  await orm.update(users).set({ role: ROLES.ADMIN, updatedAt: new Date() }).where(eq(users.id, advisor.id));
  await audit({ actor, action: AUDIT.ROLE_ADVISOR_REMOVED, targetType: 'user', targetId: advisor.id });
  return { id: advisor.id };
}

/** Admin management (§6): admins allocate other admins by identifier. At least one admin always remains. */
export async function addAdmin(actor: AuthUser, input: { name: string; username: string; tempPassword?: string }) {
  if (actor.role !== ROLES.ADMIN) throw ApiError.forbidden('Only App Administrators can allocate administrators');
  const username = input.username.trim();
  const [existing] = await orm.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) throw ApiError.conflict('That username is already taken');
  const temp = input.tempPassword && input.tempPassword.length >= 8 ? input.tempPassword : 'Admin@' + Math.floor(1000 + Math.random() * 9000);
  const [row] = await orm
    .insert(users)
    .values({ username, name: input.name.trim(), role: ROLES.ADMIN, passwordHash: hashPassword(temp), mustChangePassword: true })
    .returning();
  await audit({ actor, action: AUDIT.ROLE_ADMIN_ADDED, targetType: 'user', targetId: row.id });
  return { id: row.id, temporaryPassword: temp };
}

export async function removeAdmin(actor: AuthUser, userId: string) {
  if (actor.role !== ROLES.ADMIN) throw ApiError.forbidden();
  if ((await activeCount(ROLES.ADMIN)) <= 1) throw ApiError.conflict('At least one App Administrator must remain');
  const [target] = await orm.select().from(users).where(and(eq(users.id, userId), eq(users.role, ROLES.ADMIN))).limit(1);
  if (!target) throw ApiError.badRequest('User is not an administrator');
  await orm.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, userId));
  await audit({ actor, action: AUDIT.ROLE_ADMIN_REMOVED, targetType: 'user', targetId: userId });
  return { id: userId };
}
