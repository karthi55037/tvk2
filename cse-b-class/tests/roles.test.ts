import { describe, it, expect } from 'vitest';
import { seedUser, seedSubject } from './helpers';
import { ROLES, MAX_REPRESENTATIVES } from '@/lib/constants';
import { addRepresentative, removeRepresentative, setAdvisor, removeAdvisor, addAdmin, removeAdmin } from '@/server/services/roles';
import { createSubject, removeSubject } from '@/server/services/subjects';
import { and, eq, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { users } from '@/drizzle/schema';
import { createFolder, createItem } from '@/server/services/assignments';
import { ApiError } from '@/lib/api';

describe('role management (§3–§7)', () => {
  it('caps representatives at 4 and allows advisor/admin/rep to add', async () => {
    const staff = await seedUser({ role: ROLES.ADMIN }); // admin actor; avoids seeding a Class Advisor (setAdvisor test needs a clean slate)
    const reps = [] as Awaited<ReturnType<typeof seedUser>>[];
    for (let i = 0; i < MAX_REPRESENTATIVES; i++) {
      const s = await seedUser();
      await addRepresentative(staff.auth, s.row.id);
      (s.auth as { role: string }).role = ROLES.REPRESENTATIVE; // keep test auth in sync with the DB role change
      reps.push(s);
    }
    const fifth = await seedUser();
    await expect(addRepresentative(staff.auth, fifth.row.id)).rejects.toThrow(/at most 4/);
    // a representative can remove another rep, not themselves
    await expect(removeRepresentative(reps[0].auth, reps[0].row.id)).rejects.toBeInstanceOf(ApiError);
    await removeRepresentative(reps[1].auth, reps[0].row.id);
    // now a 5th can join (added by an existing rep)
    await addRepresentative(reps[1].auth, fifth.row.id);
  });

  it('students cannot add representatives', async () => {
    const student = await seedUser();
    const target = await seedUser();
    await expect(addRepresentative(student.auth, target.row.id)).rejects.toBeInstanceOf(ApiError);
  });

  it('advisor is set/removed by representatives or admins only, max 1', async () => {
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const student = await seedUser();
    const advisor1 = await setAdvisor(rep.auth, { name: 'First Advisor', username: `adv-${Math.random().toString(36).slice(2, 8)}` });
    expect(advisor1.id).toBeDefined();
    // max 1 advisor — appointing another requires an explicit removal first, never a silent replace
    await expect(setAdvisor(rep.auth, { name: 'Second', username: `adv2-${Math.random().toString(36).slice(2, 8)}` })).rejects.toThrow(/already exists/);
    await expect(setAdvisor(student.auth, { name: 'X', username: `adv4-${Math.random().toString(36).slice(2, 8)}` })).rejects.toBeInstanceOf(ApiError);
    await removeAdvisor(rep.auth); // removal demotes the advisor to ADMIN (audited)
    const advisor2 = await setAdvisor(rep.auth, { name: 'Second', username: `adv2-${Math.random().toString(36).slice(2, 8)}` });
    expect(advisor2.id).not.toBe(advisor1.id);
    await removeAdvisor(rep.auth);
  });

  it('admins manage admins; at least one remains', async () => {
    const admin = await seedUser({ role: ROLES.ADMIN });
    const admin2 = await seedUser({ role: ROLES.ADMIN });
    await removeAdmin(admin.auth, admin2.row.id); // fine while another admin remains
    // earlier tests in this file may have demoted advisors to ADMIN — clear everyone but the last
    const others = (await orm.select({ id: users.id }).from(users).where(and(isNull(users.deletedAt), eq(users.isActive, true), eq(users.role, ROLES.ADMIN))))
      .filter((r) => r.id !== admin.row.id);
    for (const o of others) await removeAdmin(admin.auth, o.id);
    await expect(removeAdmin(admin.auth, admin.row.id)).rejects.toThrow(/At least one/); // last admin is protected
    const student = await seedUser();
    await expect(addAdmin(student.auth, { name: 'X', username: `adm-${Math.random().toString(36).slice(2, 8)}` })).rejects.toBeInstanceOf(ApiError);
  });
});

describe('subjects & assignment structure (§13/§20)', () => {
  it('subjects CRUD is staff-only; students read-only', async () => {
    const student = await seedUser();
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    await expect(createSubject(student.auth, { name: 'Nope', code: 'NOPE1', facultyName: 'F' })).rejects.toBeInstanceOf(ApiError);
    const { subject } = await seedSubject(`S${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    const sub = subject as { name: string; code: string };
    await expect(createSubject(rep.auth, { name: sub.name + ' x', code: sub.code, facultyName: 'F' })).rejects.toThrow(/already exists/);
    await removeSubject(rep.auth, subject.id);
  });

  it('Assignment N folders: one item per subject per folder, auto numbering', async () => {
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const { subject } = await seedSubject(`A${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    const f1 = await createFolder(rep.auth);
    const f2 = await createFolder(rep.auth);
    expect(f2.number).toBe(f1.number + 1);
    const item = await createItem(rep.auth, { folderId: f1.id, subjectId: subject.id, title: 'First assignment' });
    expect(item.id).toBeDefined();
    await expect(createItem(rep.auth, { folderId: f1.id, subjectId: subject.id, title: 'Duplicate' })).rejects.toThrow(/already has an assignment/);
    // same subject CAN have an item in another folder ("Assignment 2")
    const item2 = await createItem(rep.auth, { folderId: f2.id, subjectId: subject.id, title: 'Second assignment' });
    expect(item2.folderId).toBe(f2.id);
  });
});
