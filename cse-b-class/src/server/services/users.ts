import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { orm } from '@/server/db';
import { users, meetingRequests } from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { hashPassword } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { pickDirectoryFields } from '@/server/rbac';
import { isValidDateStr, todayStr } from '@/lib/dates';

export type StudentRow = typeof users.$inferSelect;

/** Directory of students with per-role field visibility (§9). */
export async function listStudents(viewer: AuthUser) {
  const rows = await orm
    .select({
      id: users.id,
      name: users.name,
      regNo: users.regNo,
      mobile: users.mobile,
      bloodGroup: users.bloodGroup,
      dob: users.dob,
      address: users.address,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(inArray(users.role, [ROLES.STUDENT, ROLES.REPRESENTATIVE]), isNull(users.deletedAt)))
    .orderBy(asc(users.regNo));
  return rows.map((r) => ({ ...pickDirectoryFields(r, viewer.role), id: r.id, role: r.role }));
}

/** Self profile (full own data) */
export async function getOwnProfile(user: AuthUser) {
  const [u] = await orm.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u) throw ApiError.notFound();
  return {
    id: u.id,
    username: u.username,
    regNo: u.regNo,
    name: u.name,
    email: u.email,
    dob: u.dob,
    bloodGroup: u.bloodGroup,
    address: u.address,
    mobile: u.mobile,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
  };
}

/** Another student's permitted fields (advisor gets full) */
export async function getStudent(viewer: AuthUser, studentId: string) {
  const [u] = await orm.select().from(users).where(and(eq(users.id, studentId), isNull(users.deletedAt))).limit(1);
  if (!u || !(u.role === 'STUDENT' || u.role === 'REPRESENTATIVE')) throw ApiError.notFound('Student not found');
  if (viewer.id === studentId) return getOwnProfile(viewer);
  return { ...pickDirectoryFields(u, viewer.role), id: u.id, role: u.role };
}

const STUDENT_EDITABLE = ['mobile', 'address', 'bloodGroup', 'email'] as const;
const ADVISOR_EDITABLE = ['name', 'mobile', 'address', 'bloodGroup', 'email', 'dob'] as const;

/**
 * Profile update (§9). Students edit only their own (non-identity fields);
 * Advisor can edit any student's information. Every change is audited and the
 * Advisor is notified. Register number and DOB are immutable for students.
 */
export async function updateProfile(actor: AuthUser, targetId: string, patch: Record<string, string | undefined>) {
  const isSelf = actor.id === targetId;
  const advisor = actor.role === ROLES.ADVISOR;
  if (!isSelf && !advisor) throw ApiError.forbidden('Students cannot edit another student\'s information');

  const [target] = await orm.select().from(users).where(and(eq(users.id, targetId), isNull(users.deletedAt))).limit(1);
  if (!target) throw ApiError.notFound('Student not found');
  const allowed = advisor ? ADVISOR_EDITABLE : STUDENT_EDITABLE;
  const updates: Record<string, string> = {};

  for (const field of allowed) {
    const v = patch[field];
    if (v === undefined) continue;
    const val = v.trim();
    if (field === 'mobile' && val && !/^[0-9+\-\s]{6,15}$/.test(val)) throw ApiError.badRequest('Invalid mobile number');
    if (field === 'bloodGroup' && val && !/^(A|B|AB|O)[+-]$/.test(val)) throw ApiError.badRequest('Invalid blood group');
    if (field === 'dob' && val && !isValidDateStr(val)) throw ApiError.badRequest('Invalid date of birth');
    if (field === 'email' && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) throw ApiError.badRequest('Invalid email');
    updates[field] = val || null as unknown as string;
  }
  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update');

  await orm.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, targetId));

  const changed = Object.keys(updates);
  if (advisor && !isSelf) {
    await audit({ actor, action: AUDIT.PROFILE_UPDATED_BY_ADVISOR, targetType: 'student', targetId, metadata: { fields: changed } });
  } else {
    await audit({ actor, action: AUDIT.PROFILE_UPDATED_SELF, targetType: 'student', targetId, metadata: { fields: changed } });
    // Advisor notification on any student self-update (§9/§30)
    await notify({
      audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
      category: 'PROFILE_UPDATED',
      title: 'Student profile updated',
      body: `${target.name} (${target.regNo ?? target.username}) updated: ${changed.join(', ')}`,
      entityType: 'student',
      entityId: targetId,
      excludeUserIds: [targetId],
    });
  }
  return { updated: changed };
}

/** Advisor can request the student meets them after a profile update (§30). */
export async function createMeetingRequest(advisor: AuthUser, input: {
  studentId: string;
  message: string;
  date?: string;
  time?: string;
  location?: string;
  reason?: string;
}) {
  if (advisor.role !== ROLES.ADVISOR) throw ApiError.forbidden('Only the Class Advisor can request meetings');
  const [student] = await orm.select().from(users).where(and(eq(users.id, input.studentId), isNull(users.deletedAt))).limit(1);
  if (!student) throw ApiError.notFound('Student not found');
  const [row] = await orm
    .insert(meetingRequests)
    .values({
      studentId: input.studentId,
      message: input.message,
      date: input.date,
      time: input.time,
      location: input.location,
      reason: input.reason,
      createdById: advisor.id,
    })
    .returning();
  await notify({
    audience: { kind: 'users', userIds: [input.studentId] },
    category: 'MEETING_REQUEST',
    title: 'Your Class Advisor requested a meeting',
    body: input.message.slice(0, 120),
    entityType: 'meeting',
    entityId: row.id,
  });
  await audit({ actor: advisor, action: AUDIT.MEETING_CREATED, targetType: 'meeting', targetId: row.id, metadata: { studentId: input.studentId } });
  return row;
}

export async function listMeetingsFor(user: AuthUser) {
  if (user.role === ROLES.ADVISOR || user.role === ROLES.ADMIN) {
    return orm.select().from(meetingRequests).orderBy(meetingRequests.createdAt).limit(200);
  }
  return orm.select().from(meetingRequests).where(eq(meetingRequests.studentId, user.id)).orderBy(meetingRequests.createdAt);
}

export async function closeMeeting(advisor: AuthUser, id: string) {
  if (advisor.role !== ROLES.ADVISOR && advisor.role !== ROLES.ADMIN) throw ApiError.forbidden();
  const [row] = await orm.update(meetingRequests).set({ status: 'CLOSED', closedAt: new Date() }).where(eq(meetingRequests.id, id)).returning();
  if (!row) throw ApiError.notFound();
  await audit({ actor: advisor, action: AUDIT.MEETING_CLOSED, targetType: 'meeting', targetId: id });
  return row;
}

/** Password change (self). Enforced after first DOB login (§8). */
export async function changeOwnPassword(user: AuthUser, currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) throw ApiError.badRequest('New password must be at least 8 characters');
  const [u] = await orm.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u) throw ApiError.notFound();
  const { verifyPassword } = await import('@/server/auth');
  if (!verifyPassword(currentPassword, u.passwordHash)) throw ApiError.badRequest('Current password is incorrect');
  if (verifyPassword(newPassword, u.passwordHash)) throw ApiError.badRequest('New password must be different');
  await orm.update(users).set({ passwordHash: hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, user.id));
  await audit({ actor: user, action: AUDIT.PASSWORD_CHANGED, targetType: 'user', targetId: user.id });
}

/** Secure recovery: Advisor/Admin verifies identity and issues a one-time temp password (§8). */
export async function adminResetPassword(actor: AuthUser, targetUserId: string) {
  if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.ADVISOR) throw ApiError.forbidden();
  const temp = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!9';
  await orm.update(users).set({ passwordHash: hashPassword(temp), mustChangePassword: true, updatedAt: new Date() }).where(eq(users.id, targetUserId));
  await audit({ actor, action: AUDIT.PASSWORD_RESET, targetType: 'user', targetId: targetUserId });
  return { temporaryPassword: temp };
}
