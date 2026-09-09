import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { teacherVisits, users } from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { can } from '@/server/rbac';

/** Representatives create teacher-visit records (§29). Visibility: Advisor, Reps, and the involved student ONLY. */
export async function createVisit(actor: AuthUser, input: {
  studentId: string;
  teacherName: string;
  location: string;
  reason: string;
  outAt: string;
  expectedReturnAt: string;
}) {
  if (!can.createTeacherVisit(actor)) throw ApiError.forbidden('Only representatives can create teacher visit records');
  const [student] = await orm.select().from(users).where(and(eq(users.id, input.studentId), isNull(users.deletedAt))).limit(1);
  if (!student || !(student.role === 'STUDENT' || student.role === 'REPRESENTATIVE')) throw ApiError.badRequest('Student not found');
  const outAt = new Date(input.outAt);
  const expectedReturnAt = new Date(input.expectedReturnAt);
  if (isNaN(outAt.getTime()) || isNaN(expectedReturnAt.getTime())) throw ApiError.badRequest('Invalid times');
  if (expectedReturnAt <= outAt) throw ApiError.badRequest('Expected return must be after leaving time');

  const [row] = await orm
    .insert(teacherVisits)
    .values({
      studentId: input.studentId,
      teacherName: input.teacherName.trim(),
      location: input.location.trim(),
      reason: input.reason.trim(),
      outAt,
      expectedReturnAt,
      createdById: actor.id,
    })
    .returning();
  await audit({ actor, action: AUDIT.VISIT_CREATED, targetType: 'teacher_visit', targetId: row.id, metadata: { student: input.studentId } });
  await notify({
    audience: { kind: 'users', userIds: [input.studentId] },
    category: 'VISIT_CREATED',
    title: 'Teacher visit recorded',
    body: `${input.teacherName.trim()} visited — check the Visits section.`,
    entityType: 'visit',
    entityId: row.id,
  });
  return row;
}

export async function listVisits(viewer: AuthUser) {
  if (can.createTeacherVisit(viewer) && viewer.role !== ROLES.ADMIN) {
    return orm
      .select({
        id: teacherVisits.id,
        studentId: teacherVisits.studentId,
        studentName: users.name,
        regNo: users.regNo,
        teacherName: teacherVisits.teacherName,
        location: teacherVisits.location,
        reason: teacherVisits.reason,
        outAt: teacherVisits.outAt,
        expectedReturnAt: teacherVisits.expectedReturnAt,
        returnStatus: teacherVisits.returnStatus,
        returnedAt: teacherVisits.returnedAt,
      })
      .from(teacherVisits)
      .innerJoin(users, eq(teacherVisits.studentId, users.id))
      .orderBy(desc(teacherVisits.outAt))
      .limit(200);
  }
  if (viewer.role === ROLES.ADMIN) {
    return orm
      .select({
        id: teacherVisits.id,
        studentId: teacherVisits.studentId,
        studentName: users.name,
        regNo: users.regNo,
        teacherName: teacherVisits.teacherName,
        location: teacherVisits.location,
        reason: teacherVisits.reason,
        outAt: teacherVisits.outAt,
        expectedReturnAt: teacherVisits.expectedReturnAt,
        returnStatus: teacherVisits.returnStatus,
        returnedAt: teacherVisits.returnedAt,
      })
      .from(teacherVisits)
      .innerJoin(users, eq(teacherVisits.studentId, users.id))
      .orderBy(desc(teacherVisits.outAt))
      .limit(200);
  }
  // Students: only their own records (§29)
  return orm
    .select({
      id: teacherVisits.id,
      studentId: teacherVisits.studentId,
      studentName: users.name,
      regNo: users.regNo,
      teacherName: teacherVisits.teacherName,
      location: teacherVisits.location,
      reason: teacherVisits.reason,
      outAt: teacherVisits.outAt,
      expectedReturnAt: teacherVisits.expectedReturnAt,
      returnStatus: teacherVisits.returnStatus,
      returnedAt: teacherVisits.returnedAt,
    })
    .from(teacherVisits)
    .innerJoin(users, eq(teacherVisits.studentId, users.id))
    .where(eq(teacherVisits.studentId, viewer.id))
    .orderBy(desc(teacherVisits.outAt))
    .limit(100);
}

export async function markVisitReturned(actor: AuthUser, id: string) {
  if (!can.createTeacherVisit(actor)) throw ApiError.forbidden();
  const [row] = await orm
    .update(teacherVisits)
    .set({ returnStatus: 'RETURNED', returnedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(teacherVisits.id, id), eq(teacherVisits.returnStatus, 'OUT')))
    .returning();
  if (!row) throw ApiError.badRequest('Visit is not marked as out');
  await audit({ actor, action: AUDIT.VISIT_RETURNED, targetType: 'teacher_visit', targetId: id });
  return row;
}
