import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { dailyStatuses, outOfClass, users } from '@/drizzle/schema';
import { ROLES, DAILY_STATUSES, HALF_DAY_PARTS, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { can } from '@/server/rbac';
import { isValidDateStr, todayStr, tomorrowStr } from '@/lib/dates';

// ------------------------------------------------------------------ daily status (§10)

export async function setDailyStatus(user: AuthUser, input: {
  date: string;
  status: string;
  reason?: string;
  halfDayPart?: string;
  halfDayTime?: string;
}) {
  if (user.role !== ROLES.STUDENT) throw ApiError.forbidden('Daily status is for students');
  if (!isValidDateStr(input.date)) throw ApiError.badRequest('Invalid date');
  if (input.date !== todayStr() && input.date !== tomorrowStr()) {
    throw ApiError.badRequest('Daily status can only be set for today or tomorrow');
  }
  if (!(DAILY_STATUSES as readonly string[]).includes(input.status)) throw ApiError.badRequest('Invalid status');
  const reason = input.reason?.trim() || null;

  if (input.status === 'LATE' && !reason) throw ApiError.badRequest('A reason is mandatory when marking Late');
  if (input.status === 'HALF_DAY') {
    if (!input.halfDayPart || !(HALF_DAY_PARTS as readonly string[]).includes(input.halfDayPart)) {
      throw ApiError.badRequest('Choose First Half or Second Half');
    }
    if (!reason) throw ApiError.badRequest('Please provide details for the half day');
  }

  const values = {
    userId: user.id,
    date: input.date,
    status: input.status as 'PRESENT' | 'NOT_COMING' | 'LATE' | 'HALF_DAY',
    reason,
    halfDayPart: input.status === 'HALF_DAY' ? input.halfDayPart : null,
    halfDayTime: input.status === 'HALF_DAY' ? (input.halfDayTime?.trim() || null) : null,
    updatedAt: new Date(),
  };
  const [row] = await orm
    .insert(dailyStatuses)
    .values(values)
    .onConflictDoUpdate({ target: [dailyStatuses.userId, dailyStatuses.date], set: values })
    .returning();

  await audit({ actor: user, action: AUDIT.DAILY_STATUS_SET, targetType: 'daily_status', targetId: row.id, metadata: { date: input.date, status: input.status } });

  // Advisor is alerted when a student will be absent/late (category STATUS_ALERT, §31)
  if (input.status !== 'PRESENT') {
    await notify({
      audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
      category: 'STATUS_ALERT',
      title: 'Student status update',
      body: `${user.name} marked ${input.status.replace('_', ' ')} for ${input.date}`,
      entityType: 'daily_status',
      entityId: row.id,
    });
  }
  return row;
}

export async function getMyDailyStatus(user: AuthUser) {
  const rows = await orm
    .select()
    .from(dailyStatuses)
    .where(and(eq(dailyStatuses.userId, user.id), inArray(dailyStatuses.date, [todayStr(), tomorrowStr()])));
  return rows;
}

/** Class-wide daily status for a date — visible to Advisor/Reps (students see their own only). */
export async function getClassDailyStatus(viewer: AuthUser, date: string) {
  if (!can.viewOutOfClassReason(viewer)) throw ApiError.forbidden();
  return orm
    .select({
      userId: dailyStatuses.userId,
      name: users.name,
      regNo: users.regNo,
      date: dailyStatuses.date,
      status: dailyStatuses.status,
      reason: dailyStatuses.reason,
      halfDayPart: dailyStatuses.halfDayPart,
    })
    .from(dailyStatuses)
    .innerJoin(users, eq(dailyStatuses.userId, users.id))
    .where(eq(dailyStatuses.date, date));
}

// ------------------------------------------------------------------ out of class (§11)

export type OutRecord = typeof outOfClass.$inferSelect & { userName?: string; regNo?: string | null };

export async function markOutOfClass(user: AuthUser, input: { destination: string; reason: string; expectedReturnAt: string }) {
  if (user.role !== ROLES.STUDENT) throw ApiError.forbidden('Out-of-class status is for students');
  const [active] = await orm
    .select()
    .from(outOfClass)
    .where(and(eq(outOfClass.userId, user.id), eq(outOfClass.status, 'OUT')))
    .limit(1);
  if (active) throw ApiError.conflict('You are already marked out of class. Mark yourself back first.');
  const expected = new Date(input.expectedReturnAt);
  if (isNaN(expected.getTime())) throw ApiError.badRequest('Invalid expected return time');
  const now = new Date();
  if (expected.getTime() < now.getTime() - 60_000) throw ApiError.badRequest('Expected return time must be in the future');

  const [row] = await orm
    .insert(outOfClass)
    .values({
      userId: user.id,
      destination: input.destination.trim(),
      reason: input.reason.trim(),
      outAt: now,
      expectedReturnAt: expected,
    })
    .returning();

  await audit({ actor: user, action: AUDIT.OUT_OF_CLASS_MARKED, targetType: 'out_of_class', targetId: row.id });
  await notify({
    audience: { kind: 'roles', roles: [ROLES.ADVISOR, ROLES.REPRESENTATIVE] },
    category: 'OUT_OF_CLASS',
    title: 'Student went out of class',
    body: `${user.name} is out — destination: ${input.destination.trim()}`, // reason NOT included (§11/§36)
    entityType: 'out_of_class',
    entityId: row.id,
  });
  return row;
}

export async function markBack(user: AuthUser) {
  const [active] = await orm
    .select()
    .from(outOfClass)
    .where(and(eq(outOfClass.userId, user.id), eq(outOfClass.status, 'OUT')))
    .limit(1);
  if (!active) throw ApiError.badRequest('You are not marked out of class');
  const [row] = await orm.update(outOfClass).set({ status: 'BACK', backAt: new Date() }).where(eq(outOfClass.id, active.id)).returning();
  await audit({ actor: user, action: AUDIT.OUT_OF_CLASS_RETURNED, targetType: 'out_of_class', targetId: row.id });
  return row;
}

export async function clearOutStatus(actor: AuthUser, recordId: string) {
  if (!can.clearOutOfClass(actor)) throw ApiError.forbidden('Only the Advisor or Representatives can clear an out-of-class status');
  const [row] = await orm
    .update(outOfClass)
    .set({ status: 'CLEARED', clearedById: actor.id, clearedAt: new Date() })
    .where(and(eq(outOfClass.id, recordId), eq(outOfClass.status, 'OUT')))
    .returning();
  if (!row) throw ApiError.badRequest('Record is not currently out');
  await audit({ actor, action: AUDIT.OUT_OF_CLASS_CLEARED, targetType: 'out_of_class', targetId: recordId });
  return row;
}

/**
 * List out-of-class records. Privacy (§11/§36):
 * - Everyone sees name, status, destination, leaving time, expected return.
 * - `reason` is included ONLY for Advisor + Representatives.
 */
export async function listOutOfClass(viewer: AuthUser, opts: { activeOnly?: boolean } = {}) {
  const rows = await orm
    .select({
      id: outOfClass.id,
      userId: outOfClass.userId,
      name: users.name,
      regNo: users.regNo,
      destination: outOfClass.destination,
      reason: outOfClass.reason,
      outAt: outOfClass.outAt,
      expectedReturnAt: outOfClass.expectedReturnAt,
      backAt: outOfClass.backAt,
      status: outOfClass.status,
    })
    .from(outOfClass)
    .innerJoin(users, eq(outOfClass.userId, users.id))
    .where(opts.activeOnly ? eq(outOfClass.status, 'OUT') : undefined)
    .orderBy(desc(outOfClass.outAt))
    .limit(100);
  const showReason = can.viewOutOfClassReason(viewer);
  return rows.map((r) => ({
    ...r,
    reason: showReason ? r.reason : undefined, // stripped for students (§11)
  }));
}

export async function getMyActiveOut(user: AuthUser) {
  const [row] = await orm
    .select()
    .from(outOfClass)
    .where(and(eq(outOfClass.userId, user.id), eq(outOfClass.status, 'OUT')))
    .limit(1);
  return row || null;
}
