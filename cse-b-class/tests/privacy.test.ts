import { describe, it, expect } from 'vitest';
import { seedUser } from './helpers';
import { ROLES } from '@/lib/constants';
import { listStudents, getStudent, updateProfile } from '@/server/services/users';
import { submitLeave, getLeave, listLeaves, decideLeave } from '@/server/services/leave';
import { submitOD, getOD } from '@/server/services/od';
import { markOutOfClass, listOutOfClass } from '@/server/services/status';
import { createVisit, listVisits } from '@/server/services/visits';
import { ApiError } from '@/lib/api';

describe('privacy & access control (§9/§11/§14/§15/§29/§36)', () => {
  it('students see only name/regNo/mobile of other students', async () => {
    const a = await seedUser();
    await seedUser({ role: ROLES.REPRESENTATIVE });
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const dir = await listStudents(a.auth);
    const repRow = dir.find((d) => d.role === ROLES.REPRESENTATIVE)!;
    expect(Object.keys(repRow).sort()).toEqual(['id', 'mobile', 'name', 'regNo', 'role'].sort());
    void advisor;
  });

  it('representatives additionally see blood group, never dob/address', async () => {
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const target = await seedUser();
    const view = (await getStudent(rep.auth, target.row.id)) as { bloodGroup?: string | null; dob?: string; address?: string };
    expect(view.bloodGroup).toBeDefined();
    expect(view.dob).toBeUndefined();
    expect(view.address).toBeUndefined();
  });

  it('advisor sees full student info', async () => {
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const target = await seedUser({ dob: '2005-05-05', address: '2 Privacy Lane' });
    const view = (await getStudent(advisor.auth, target.row.id)) as { dob?: string; address?: string };
    expect(view.dob).toBe('2005-05-05');
    expect(view.address).toBe('2 Privacy Lane');
  });

  it('a student cannot edit another student (IDOR)', async () => {
    const a = await seedUser();
    const b = await seedUser();
    await expect(updateProfile(a.auth, b.row.id, { mobile: '9999999999' })).rejects.toBeInstanceOf(ApiError);
  });

  it('leave reason is visible to owner+advisor only — never reps/admins/other students', async () => {
    const student = await seedUser();
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const admin = await seedUser({ role: ROLES.ADMIN });
    const leave = await submitLeave(student.auth, { fromDate: '2026-10-01', toDate: '2026-10-02', reason: 'SECRET-REASON' });

    const asOwner = (await getLeave(student.auth, leave.id)) as { reason?: string };
    expect(asOwner.reason).toBe('SECRET-REASON');
    const asAdvisor = (await getLeave(advisor.auth, leave.id)) as { reason?: string };
    expect(asAdvisor.reason).toBe('SECRET-REASON');
    await expect(getLeave(rep.auth, leave.id)).rejects.toBeInstanceOf(ApiError); // pre-letter stage: fully private
    await expect(getLeave(admin.auth, leave.id)).rejects.toBeInstanceOf(ApiError); // PENDING: advisor-only, even for admins
    await decideLeave(advisor.auth, leave.id, 'APPROVE');
    const adminView = await getLeave(admin.auth, leave.id); // post-decision: status visible, reason never
    expect((adminView as { reason?: string }).reason).toBeUndefined();

    const repList = (await listLeaves(rep.auth)) as Array<{ reason?: string }>;
    expect(repList.every((r) => r.reason === undefined)).toBe(true);
  });

  it('OD reason is hidden from representatives and admins', async () => {
    const student = await seedUser();
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const od = await submitOD(student.auth, { programName: 'Event', place: 'Hall', date: '2026-10-05', fromTime: '09:00', toTime: '12:00', reason: 'OD-SECRET' });
    await expect(getOD(rep.auth, od.id)).rejects.toBeInstanceOf(ApiError);
    const admin = await seedUser({ role: ROLES.ADMIN });
    await expect(getOD(admin.auth, od.id)).rejects.toBeInstanceOf(ApiError); // PENDING OD: advisor-only, reason never leaves advisor
    void advisor;
  });

  it('out-of-class reason is visible ONLY to advisor + representatives (§11)', async () => {
    const student = await seedUser();
    const other = await seedUser();
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    await markOutOfClass(student.auth, { destination: 'Office', reason: 'OUT-SECRET', expectedReturnAt: new Date(Date.now() + 1800000).toISOString() });

    const studentView = await listOutOfClass(other.auth, { activeOnly: true });
    expect(studentView[0].reason).toBeUndefined();
    const repView = await listOutOfClass(rep.auth, { activeOnly: true });
    expect(repView[0].reason).toBe('OUT-SECRET');
    const advisorView = await listOutOfClass(advisor.auth, { activeOnly: true });
    expect(advisorView[0].reason).toBe('OUT-SECRET');
  });

  it('teacher visits are visible only to the involved student + staff (§29)', async () => {
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const student = await seedUser();
    const outsider = await seedUser();
    const visit = await createVisit(rep.auth, {
      studentId: student.row.id,
      teacherName: 'Dr. X',
      location: 'Staff room',
      reason: 'Internal discussion',
      outAt: new Date().toISOString(),
      expectedReturnAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const studentVisits = await listVisits(student.auth);
    expect(studentVisits.map((v) => v.id)).toContain(visit.id);
    const outsiderVisits = await listVisits(outsider.auth);
    expect(outsiderVisits.map((v) => v.id)).not.toContain(visit.id);
    const repVisits = await listVisits(rep.auth);
    expect(repVisits.map((v) => v.id)).toContain(visit.id);
  });
});
