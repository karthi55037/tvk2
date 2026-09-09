import { describe, it, expect } from 'vitest';
import { seedUser } from './helpers';
import { ROLES } from '@/lib/constants';
import { submitLeave, decideLeave, withdrawLeave, confirmLeaveLetter, resolveWithdrawal } from '@/server/services/leave';
import { submitOD, decideOD, confirmODLetter } from '@/server/services/od';
import { ApiError } from '@/lib/api';

describe('leave workflow (§14)', () => {
  it('duplicate submission (retry / double-tap) returns the existing request instead of creating one', async () => {
    const student = await seedUser();
    const first = await submitLeave(student.auth, { fromDate: '2026-12-01', toDate: '2026-12-02', reason: 'Retry safety' });
    const again = await submitLeave(student.auth, { fromDate: '2026-12-01', toDate: '2026-12-02', reason: 'Retry safety' });
    expect(again.id).toBe(first.id);
    const od1 = await submitOD(student.auth, { programName: 'Hackathon', place: 'Auditorium', date: '2026-12-05', fromTime: '09:00', toTime: '17:00', reason: 'Participating' });
    const od2 = await submitOD(student.auth, { programName: 'Hackathon', place: 'Auditorium', date: '2026-12-05', fromTime: '09:00', toTime: '17:00', reason: 'Participating' });
    expect(od2.id).toBe(od1.id);
  });

  it('full flow: submit → advisor approve → letter posted → any ONE rep confirms', async () => {
    const student = await seedUser();
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });

    const leave = await submitLeave(student.auth, { fromDate: '2026-10-01', toDate: '2026-10-03', reason: 'Family event' });
    expect(leave.status).toBe('PENDING');

    // only the advisor can decide
    await expect(decideLeave(rep.auth, leave.id, 'APPROVE')).rejects.toBeInstanceOf(ApiError);
    const approved = await decideLeave(advisor.auth, leave.id, 'APPROVE');
    expect(approved.status).toBe('LETTER_PENDING');

    // withdrawal after approval must NOT silently cancel — becomes a request
    const req = await withdrawLeave(student.auth, leave.id);
    expect(req.status).toBe('LETTER_PENDING');
    expect(req.withdrawalRequested).toBe(true);

    // advisor declines the withdrawal, flow continues
    await resolveWithdrawal(advisor.auth, leave.id, false);

    // student posts letter
    const posted = await import('@/server/services/leave').then((m) => m.postLeaveLetter(student.auth, leave.id, 'file-1'));
    expect(posted.leave.status).toBe('LETTER_POSTED');

    // one rep confirming is enough
    const confirmed = await confirmLeaveLetter(rep.auth, leave.id);
    expect(confirmed.status).toBe('REP_CONFIRMED');
    await expect(confirmLeaveLetter(rep.auth, leave.id)).rejects.toBeInstanceOf(ApiError); // idempotent guard
  });

  it('pending leave can be withdrawn by the owner only', async () => {
    const student = await seedUser();
    const other = await seedUser();
    const leave = await submitLeave(student.auth, { fromDate: '2026-10-01', toDate: '2026-10-01', reason: 'Test' });
    await expect(withdrawLeave(other.auth, leave.id)).rejects.toBeInstanceOf(ApiError);
    const withdrawn = await withdrawLeave(student.auth, leave.id);
    expect(withdrawn.status).toBe('WITHDRAWN');
  });

  it('reject works and ends the flow', async () => {
    const student = await seedUser();
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const leave = await submitLeave(student.auth, { fromDate: '2026-10-02', toDate: '2026-10-02', reason: 'Test' });
    const rejected = await decideLeave(advisor.auth, leave.id, 'REJECT');
    expect(rejected.status).toBe('REJECTED');
    await expect(decideLeave(advisor.auth, leave.id, 'APPROVE')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('od workflow (§15)', () => {
  it('submit (no letter) → advisor-only approve → letter required → posted → rep confirms completion', async () => {
    const student = await seedUser();
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const advisor = await seedUser({ role: ROLES.ADVISOR });

    const od = await submitOD(student.auth, { programName: 'Hackathon', place: 'Chennai', date: '2026-10-05', fromTime: '09:00', toTime: '17:00', reason: 'Event' });
    expect(od.status).toBe('PENDING');

    // reps can never approve OD
    await expect(decideOD(rep.auth, od.id, 'APPROVE')).rejects.toBeInstanceOf(ApiError);
    const approved = await decideOD(advisor.auth, od.id, 'APPROVE');
    expect(approved.status).toBe('LETTER_REQUIRED');

    const { postODLetter } = await import('@/server/services/od');
    const posted = await postODLetter(student.auth, od.id, 'od-file-1');
    expect(posted.od.status).toBe('LETTER_POSTED');

    const confirmed = await confirmODLetter(rep.auth, od.id);
    expect(confirmed.status).toBe('REP_CONFIRMED');
  });

  it('validates times and required fields', async () => {
    const student = await seedUser();
    await expect(submitOD(student.auth, { programName: 'X', place: 'Y', date: '2026-10-05', fromTime: '15:00', toTime: '14:00', reason: 'Bad times' })).rejects.toBeInstanceOf(ApiError);
    await expect(submitOD(student.auth, { programName: 'X', place: 'Y', date: 'bad-date', fromTime: '09:00', toTime: '10:00', reason: 'Bad date' })).rejects.toBeInstanceOf(ApiError);
  });
});
