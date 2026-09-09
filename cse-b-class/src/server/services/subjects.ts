import { asc, eq, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { subjects, timetableSlots } from '@/drizzle/schema';
import { can } from '@/server/rbac';
import { ApiError } from '@/lib/api';
import { AUDIT, audit } from '@/server/audit';
import type { AuthUser } from '@/server/auth';

export async function listSubjects() {
  return orm.select().from(subjects).where(isNull(subjects.deletedAt)).orderBy(asc(subjects.name));
}

export async function createSubject(actor: AuthUser, input: {
  name: string;
  code: string;
  facultyName: string;
  facultyFloor?: string;
  facultyRoom?: string;
}) {
  if (!can.manageSubjects(actor)) throw ApiError.forbidden();
  const code = input.code.trim().toUpperCase();
  const [existing] = await orm.select().from(subjects).where(eq(subjects.code, code)).limit(1);
  if (existing && !existing.deletedAt) throw ApiError.conflict('A subject with this code already exists');
  if (existing && existing.deletedAt) {
    await orm.update(subjects).set({ deletedAt: null, name: input.name, facultyName: input.facultyName, facultyFloor: input.facultyFloor, facultyRoom: input.facultyRoom }).where(eq(subjects.id, existing.id));
    await audit({ actor, action: AUDIT.SUBJECT_CREATED, targetType: 'subject', targetId: existing.id });
    return { id: existing.id };
  }
  const [created] = await orm.insert(subjects).values({
    name: input.name.trim(),
    code,
    facultyName: input.facultyName.trim(),
    facultyFloor: input.facultyFloor,
    facultyRoom: input.facultyRoom,
  }).returning();
  await audit({ actor, action: AUDIT.SUBJECT_CREATED, targetType: 'subject', targetId: created.id, metadata: { code } });
  return created;
}

export async function updateSubject(actor: AuthUser, id: string, patch: Partial<{
  name: string;
  code: string;
  facultyName: string;
  facultyFloor: string;
  facultyRoom: string;
}>) {
  if (!can.manageSubjects(actor)) throw ApiError.forbidden();
  const [existing] = await orm.select().from(subjects).where(eq(subjects.id, id)).limit(1);
  if (!existing || existing.deletedAt) throw ApiError.notFound('Subject not found');
  await orm.update(subjects).set({ ...patch, updatedAt: new Date() }).where(eq(subjects.id, id));
  await audit({ actor, action: AUDIT.SUBJECT_UPDATED, targetType: 'subject', targetId: id, metadata: { fields: Object.keys(patch) } });
  return { id };
}

/** Soft-delete (retained in history). Timetable slots keep working with subjectId intact. */
export async function removeSubject(actor: AuthUser, id: string) {
  if (!can.manageSubjects(actor)) throw ApiError.forbidden();
  const [existing] = await orm.select().from(subjects).where(eq(subjects.id, id)).limit(1);
  if (!existing || existing.deletedAt) throw ApiError.notFound('Subject not found');
  await orm.update(subjects).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(subjects.id, id));
  await orm.update(timetableSlots).set({ subjectId: null }).where(eq(timetableSlots.subjectId, id));
  await audit({ actor, action: AUDIT.SUBJECT_REMOVED, targetType: 'subject', targetId: id });
  return { id };
}
