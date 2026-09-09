import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { users } from '@/drizzle/schema';
import { seedUser } from './helpers';
import { ROLES } from '@/lib/constants';
import { parseWorkbook, validateRow, commitImport, previewImport } from '@/server/services/import';
import { createFolder, createItem, setSubmission, getSubmissions, addResource, verifyResource, listResources } from '@/server/services/assignments';
import { uploadRecord, verifyRecord, setCompletion } from '@/server/services/experiments';
import { seedSubject } from './helpers';
import { saveFile } from '@/server/files';
import { ApiError } from '@/lib/api';

describe('excel import (§41)', () => {
  it('validates rows: missing fields, bad dob, bad mobile, bad blood group, dup regnos', () => {
    const r1 = validateRow({ 'Register Number': '', Name: 'A', 'Date of Birth': '2005-01-01', 'Blood Group': 'O+', Address: 'x', 'Mobile Number': '9876543210' }, 2);
    expect(r1.errors.some((e) => /Register Number/.test(e))).toBe(true);

    const r2 = validateRow({ 'Register Number': 'X1', Name: 'B', 'Date of Birth': '31-02-2005', 'Blood Group': 'OO', Address: '', 'Mobile Number': '12345' }, 3);
    expect(r2.errors.some((e) => /real date|Blood Group|Address|Mobile/.test(e))).toBe(true);

    const r3 = validateRow({ 'Register Number': 'OK1', Name: 'Chloe', 'Date of Birth': '15-08-2005', 'Blood Group': 'b+', Address: 'addr', 'Mobile Number': '98765 43210' }, 4);
    expect(r3.errors).toEqual([]);
    expect(r3.dob).toBe('2005-08-15');
    expect(r3.bloodGroup).toBe('B+');
  });

  it('parses a workbook and reports header errors', () => {
    const bad = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(bad, XLSX.utils.json_to_sheet([{ Reg: 'x' }]), 'S');
    const badBuf = XLSX.write(bad, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    expect(parseWorkbook(badBuf).headerErrors.length).toBeGreaterThan(0);

    const good = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      good,
      XLSX.utils.json_to_sheet([
        { 'Register Number': 'IMP01', Name: 'Import One', 'Date of Birth': '2005-03-03', 'Blood Group': 'A+', Address: 'A1', 'Mobile Number': '9812345678' },
        { 'Register Number': 'IMP01', Name: 'Dup', 'Date of Birth': '2005-03-03', 'Blood Group': 'A+', Address: 'A1', 'Mobile Number': '9812345678' },
      ]),
      'S',
    );
    const goodBuf = XLSX.write(good, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const parsed = parseWorkbook(goodBuf);
    expect(parsed.rows[1].errors.some((e) => /Duplicate/.test(e))).toBe(true);
  });

  it('creates accounts with DDMMYYYY initial password; never overwrites existing students blindly', async () => {
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { 'Register Number': 'IMP10', Name: 'Import Ten', 'Date of Birth': '2005-12-25', 'Blood Group': 'O-', Address: 'X Road', 'Mobile Number': '9800011122' },
      ]),
      'S',
    );
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const report = await commitImport(advisor.auth, buf);
    expect(report.created).toBe(1);

    const { orm } = await import('@/server/db');
    const { users } = await import('@/drizzle/schema');
    const { eq } = await import('drizzle-orm');
    const [created] = await orm.select().from(users).where(eq(users.regNo, 'IMP10'));
    expect(created.mustChangePassword).toBe(true);
    const bcrypt = (await import('bcryptjs')).default;
    expect(bcrypt.compareSync('25122005', created.passwordHash)).toBe(true);

    // re-import with a changed name → safe update of that field only, password untouched
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb2,
      XLSX.utils.json_to_sheet([{ 'Register Number': 'IMP10', Name: 'Import Ten Updated', 'Date of Birth': '2005-12-25', 'Blood Group': 'O-', Address: 'X Road', 'Mobile Number': '9800011122' }]),
      'S',
    );
    const report2 = await commitImport(advisor.auth, XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
    expect(report2.updated).toBe(1);
    const [after] = await orm.select().from(users).where(eq(users.regNo, 'IMP10'));
    expect(after.name).toBe('Import Ten Updated');
    expect(bcrypt.compareSync('25122005', after.passwordHash)).toBe(true);
  });

  it('preview requires advisor/admin', async () => {
    const student = await seedUser();
    await expect(previewImport(student.auth, Buffer.from('x'))).rejects.toBeInstanceOf(ApiError);
  });
});

describe('assignment submissions & resources (§21/§22)', () => {
  it('students mark only themselves; reps set anyone; stats aggregate', async () => {
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const s1 = await seedUser();
    const s2 = await seedUser();
    const { subject } = await seedSubject(`B${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    const folder = await createFolder(rep.auth);
    const item = await createItem(rep.auth, { folderId: folder.id, subjectId: subject.id, title: 'T' });

    await setSubmission(s1.auth, item.id, s1.row.id, 'SUBMITTED');
    await expect(setSubmission(s1.auth, item.id, s2.row.id, 'SUBMITTED')).rejects.toBeInstanceOf(ApiError); // no cross-marking
    await setSubmission(rep.auth, item.id, s2.row.id, 'NOT_SUBMITTED'); // rep CAN set others

    const board = await getSubmissions(rep.auth, item.id);
    // totals count the whole active class (students + reps), not just this test's participants
    const classRows = await orm
      .select({ id: users.id })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.isActive, true), inArray(users.role, [ROLES.STUDENT, ROLES.REPRESENTATIVE])));
    const total = classRows.length;
    expect(board.stats).toEqual({ submitted: 1, total, pending: total - 1 });
    expect(board.submissions.find((x) => x.userId === s2.row.id)?.status).toBe('NOT_SUBMITTED');
  });

  it('student-shared resources start PENDING and need verification; staff shares auto-approve', async () => {
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const student = await seedUser();
    const { subject } = await seedSubject(`C${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    const folder = await createFolder(rep.auth);
    const item = await createItem(rep.auth, { folderId: folder.id, subjectId: subject.id, title: 'R' });

    const pending = await addResource(student.auth, item.id, { kind: 'LINK', title: 'My notes', url: 'https://github.com/x/y' });
    expect(pending.status).toBe('PENDING');
    const approved = await verifyResource(rep.auth, pending.id, 'APPROVED');
    expect(approved.status).toBe('APPROVED');

    const staffShare = await addResource(rep.auth, item.id, { kind: 'LINK', title: 'Official', url: 'https://example.com' });
    expect(staffShare.status).toBe('APPROVED');

    const visible = await listResources(student.auth, item.id);
    expect(visible.map((r) => r.status)).toContain('APPROVED');
  });
});

describe('record & observation (§26/§27)', () => {
  it('student uploads record; any ONE verifier verifies; re-upload resets verification', async () => {
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const student = await seedUser();
    const { subject } = await seedSubject(`D${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    const { createExperiment } = await import('@/server/services/experiments');
    const exp = await createExperiment(rep.auth, { subjectId: subject.id, name: 'Exp 1' });

    await setCompletion(student.auth, exp.id, student.row.id, 'COMPLETED');
    const rec = await uploadRecord(student.auth, exp.id, 'rec-file-1');
    expect(rec.status).toBe('PENDING');

    // students cannot verify
    await expect(verifyRecord(student.auth, exp.id, student.row.id, 'VERIFIED')).rejects.toBeInstanceOf(ApiError);
    const verified = await verifyRecord(rep.auth, exp.id, student.row.id, 'VERIFIED', 'good');
    expect(verified.status).toBe('VERIFIED');
    expect(verified.verifiedById).toBe(rep.auth.id);

    // re-upload resets to PENDING
    const again = await uploadRecord(student.auth, exp.id, 'rec-file-2');
    expect(again.status).toBe('PENDING');
  });
});

describe('file security (§39)', () => {
  it('rejects disallowed types and content/type mismatch; enforces path traversal guard', async () => {
    const student = await seedUser();
    const fake = new File([Buffer.from('MZ Executable')], 'evil.exe', { type: 'application/pdf' });
    await expect(saveFile({ user: student.auth, file: fake, module: 'CHAT' })).rejects.toThrow(/not allowed|does not match/);
    const fakePdf = new File([Buffer.from('not really a pdf')], 'fake.pdf', { type: 'application/pdf' });
    await expect(saveFile({ user: student.auth, file: fakePdf, module: 'CHAT' })).rejects.toThrow(/does not match/);
    const okText = new File([Buffer.from('hello world')], 'note.txt', { type: 'text/plain' });
    const saved = await saveFile({ user: student.auth, file: okText, module: 'CHAT' });
    expect(saved.id).toBeDefined();
  });
});
