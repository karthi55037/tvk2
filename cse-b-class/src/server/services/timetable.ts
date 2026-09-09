import { and, eq } from 'drizzle-orm';
import { orm } from '@/server/db';
import { subjects, timetableSlots } from '@/drizzle/schema';
import { can } from '@/server/rbac';
import { ApiError } from '@/lib/api';
import { AUDIT, audit } from '@/server/audit';
import type { AuthUser } from '@/server/auth';
import { PERIODS } from '@/lib/constants';

export type SlotInput = {
  dayOfWeek: number;
  period: number;
  subjectId?: string | null;
  isLab?: boolean;
  labName?: string | null;
  labFloor?: string | null;
};

export async function getTimetable() {
  const rows = await orm
    .select({
      id: timetableSlots.id,
      dayOfWeek: timetableSlots.dayOfWeek,
      period: timetableSlots.period,
      subjectId: timetableSlots.subjectId,
      isLab: timetableSlots.isLab,
      labName: timetableSlots.labName,
      labFloor: timetableSlots.labFloor,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      facultyName: subjects.facultyName,
    })
    .from(timetableSlots)
    .leftJoin(subjects, eq(timetableSlots.subjectId, subjects.id));
  return rows;
}

/** Upsert a single slot (§12). Lab periods carry lab name + floor; regular periods use the fixed classroom. */
export async function upsertSlot(actor: AuthUser, input: SlotInput) {
  if (!can.manageTimetable(actor)) throw ApiError.forbidden('Only the Advisor / Representatives manage the timetable');
  if (![1, 2, 3, 4, 5, 6].includes(input.dayOfWeek)) throw ApiError.badRequest('Invalid day');
  if (!(PERIODS as readonly number[]).includes(input.period)) throw ApiError.badRequest('Invalid period (1-8)');
  let subjectId: string | null = null;
  if (input.subjectId) {
    const [subject] = await orm.select().from(subjects).where(eq(subjects.id, input.subjectId)).limit(1);
    if (!subject || subject.deletedAt) throw ApiError.badRequest('Unknown subject');
    subjectId = subject.id;
  }
  if (input.isLab && (!input.labName || !input.labName.trim())) throw ApiError.badRequest('Lab periods need a lab name');
  const values = {
    dayOfWeek: input.dayOfWeek,
    period: input.period,
    subjectId,
    isLab: Boolean(input.isLab),
    labName: input.isLab ? input.labName : null,
    labFloor: input.isLab ? input.labFloor : null,
    updatedAt: new Date(),
  };
  await orm
    .insert(timetableSlots)
    .values(values)
    .onConflictDoUpdate({ target: [timetableSlots.dayOfWeek, timetableSlots.period], set: values });
  await audit({ actor, action: AUDIT.TIMETABLE_UPDATED, targetType: 'timetable', targetId: `${input.dayOfWeek}-${input.period}`, metadata: values as never });
  return { ok: true };
}

export async function clearSlot(actor: AuthUser, dayOfWeek: number, period: number) {
  if (!can.manageTimetable(actor)) throw ApiError.forbidden();
  await orm.delete(timetableSlots).where(eq(timetableSlots.dayOfWeek, dayOfWeek));
  void period;
  await orm.delete(timetableSlots).where(
    (await import('drizzle-orm')).and(eq(timetableSlots.dayOfWeek, dayOfWeek), eq(timetableSlots.period, period)),
  );
  await audit({ actor, action: AUDIT.TIMETABLE_UPDATED, targetType: 'timetable', targetId: `${dayOfWeek}-${period}`, metadata: { cleared: true } });
  return { ok: true };
}
