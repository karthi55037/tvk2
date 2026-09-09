import { describe, it, expect } from 'vitest';
import { seedUser } from './helpers';
import { ROLES, CLASS_THREAD } from '@/lib/constants';
import { setDailyStatus, markOutOfClass, markBack } from '@/server/services/status';
import { postMessage, listMessages, emergencyTakedown, moderateThreadMessage, reportMessage, resolveReport } from '@/server/services/chat';
import { createClearingRequest, approveClearing, clearingState } from '@/server/services/clearing';
import { ApiError } from '@/lib/api';
import { todayStr, tomorrowStr } from '@/lib/dates';

describe('daily status (§10)', () => {
  it('only today and tomorrow allowed', async () => {
    const student = await seedUser();
    await setDailyStatus(student.auth, { date: todayStr(), status: 'PRESENT' });
    await setDailyStatus(student.auth, { date: tomorrowStr(), status: 'NOT_COMING' });
    await expect(setDailyStatus(student.auth, { date: '2026-01-01', status: 'PRESENT' })).rejects.toThrow(/today or tomorrow/);
  });

  it('late requires a reason; half-day requires part', async () => {
    const student = await seedUser();
    await expect(setDailyStatus(student.auth, { date: todayStr(), status: 'LATE' })).rejects.toThrow(/mandatory/);
    await expect(setDailyStatus(student.auth, { date: todayStr(), status: 'HALF_DAY', reason: 'no part' })).rejects.toThrow(/First Half or Second/);
    const ok = await setDailyStatus(student.auth, { date: todayStr(), status: 'HALF_DAY', reason: 'Doctor visit', halfDayPart: 'SECOND' });
    expect(ok.halfDayPart).toBe('SECOND');
  });
});

describe('out of class (§11)', () => {
  it('one active record per student; back/clear lifecycle', async () => {
    const student = await seedUser();
    await markOutOfClass(student.auth, { destination: 'Office', reason: 'R1', expectedReturnAt: new Date(Date.now() + 1800000).toISOString() });
    await expect(markOutOfClass(student.auth, { destination: 'X', reason: 'R2', expectedReturnAt: new Date(Date.now() + 1800000).toISOString() })).rejects.toThrow(/already marked out/);
    const back = await markBack(student.auth);
    expect(back.status).toBe('BACK');
  });
});

describe('chat modules (§17/§18/§19/§23/§28)', () => {
  it('class chat bans emojis, blocks empty messages', async () => {
    const student = await seedUser();
    await expect(postMessage(student.auth, { threadType: 'CLASS', threadId: CLASS_THREAD }, { body: 'Hi 🎉' })).rejects.toThrow(/emojis/);
    await expect(postMessage(student.auth, { threadType: 'CLASS', threadId: CLASS_THREAD }, {})).rejects.toThrow(/empty/);
  });

  it('threads are isolated: assignment thread id must exist', async () => {
    const student = await seedUser();
    await expect(postMessage(student.auth, { threadType: 'ASSIGNMENT', threadId: 'does-not-exist' }, { body: 'x' })).rejects.toBeInstanceOf(ApiError);
  });

  it('clearing requires advisor + every rep + admin; auto-executes when complete', async () => {
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const rep2 = await seedUser({ role: ROLES.REPRESENTATIVE });
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const admin = await seedUser({ role: ROLES.ADMIN });
    const msg = await postMessage(rep.auth, { threadType: 'CLASS', threadId: CLASS_THREAD }, { body: 'needs clearing' });

    const req = await createClearingRequest(advisor.auth, { scope: 'CLASS_CHAT_MESSAGE', targetId: msg.id, reason: 'reported content' });
    await approveClearing(rep.auth, req.id);
    let state = await clearingState(req.id);
    expect(state.satisfied).toBe(false); // rep2/advisor/admin missing (advisor is requester — must also approve)
    await approveClearing(rep2.auth, req.id);
    state = await clearingState(req.id);
    expect(state.satisfied).toBe(false);
    await approveClearing(advisor.auth, req.id);
    state = await clearingState(req.id);
    expect(state.satisfied).toBe(false); // admin still missing
    const done = await approveClearing(admin.auth, req.id);
    expect(done.status).toBe('EXECUTED');

    const msgs = await listMessages(rep.auth, { threadType: 'CLASS', threadId: CLASS_THREAD });
    expect(msgs.find((m) => m.id === msg.id)?.deleted).toBe(true);
  });

  it('students cannot request clearing; reps cannot delete directly (no delete API)', async () => {
    const student = await seedUser();
    const msg = await postMessage(student.auth, { threadType: 'CLASS', threadId: CLASS_THREAD }, { body: 'student msg' });
    await expect(createClearingRequest(student.auth, { scope: 'CLASS_CHAT_MESSAGE', targetId: msg.id, reason: 'nope' })).rejects.toBeInstanceOf(ApiError);
  });

  it('reports flow to advisor; students cannot report or resolve', async () => {
    const student = await seedUser();
    const rep = await seedUser({ role: ROLES.REPRESENTATIVE });
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const msg = await postMessage(student.auth, { threadType: 'CLASS', threadId: CLASS_THREAD }, { body: 'report me' });
    await expect(reportMessage(student.auth, { messageId: msg.id, category: 'SPAM' })).rejects.toBeInstanceOf(ApiError);
    const report = await reportMessage(rep.auth, { messageId: msg.id, category: 'ABUSE', description: 'bad' });
    const resolved = await resolveReport(advisor.auth, report.id, 'RESOLVED', 'actioned');
    expect(resolved.status).toBe('RESOLVED');
  });

  it('emergency takedown is admin-only and class-chat only; assignment chats moderated by advisor/admin', async () => {
    const admin = await seedUser({ role: ROLES.ADMIN });
    const advisor = await seedUser({ role: ROLES.ADVISOR });
    const student = await seedUser();
    const msg = await postMessage(student.auth, { threadType: 'CLASS', threadId: CLASS_THREAD }, { body: 'emergency case' });
    await expect(emergencyTakedown(advisor.auth, msg.id, 'no')).rejects.toBeInstanceOf(ApiError);
    await emergencyTakedown(admin.auth, msg.id, 'serious violation');
    const msgs = await listMessages(student.auth, { threadType: 'CLASS', threadId: CLASS_THREAD });
    expect(msgs.find((m) => m.id === msg.id)?.deleted).toBe(true);
    // advisor moderation of class chat must go through the multi-party clearing approval flow
    const msg2 = await postMessage(student.auth, { threadType: 'CLASS', threadId: CLASS_THREAD }, { body: 'needs clearing approval' });
    await expect(moderateThreadMessage(advisor.auth, msg2.id, 'x')).rejects.toThrow(/clearing approval flow/);
  });
});
