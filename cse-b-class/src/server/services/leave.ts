import { and, desc, eq, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { leaveDocuments, leaveRequests, users } from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { isValidDateStr } from '@/lib/dates';

const STAFF_ONLY_STATUSES = ['LETTER_PENDING', 'LETTER_POSTED', 'REP_CONFIRMED'];

/** Strip private fields depending on viewer (§14/§36): leave reason is owner + Advisor only. */
function visibleLeave(row: typeof leaveRequests.$inferSelect, viewer: AuthUser) {
  const isOwner = row.userId === viewer.id;
  const isAdvisor = viewer.role === ROLES.ADVISOR;
  const base = {
    id: row.id,
    userId: row.userId,
    fromDate: row.fromDate,
    toDate: row.toDate,
    status: row.status,
    withdrawalRequested: row.withdrawalRequested,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
  };
  if (isOwner || isAdvisor) return { ...base, reason: row.reason, contact: row.contact };
  return base;
}

export async function submitLeave(user: AuthUser, input: { fromDate: string; toDate: string; reason: string; contact?: string }) {
  if (user.role !== ROLES.STUDENT) throw ApiError.forbidden('Leave requests are for students');
  if (!isValidDateStr(input.fromDate) || !isValidDateStr(input.toDate)) throw ApiError.badRequest('Invalid dates');
  if (input.toDate < input.fromDate) throw ApiError.badRequest('End date cannot be before start date');
  if (!input.reason.trim()) throw ApiError.badRequest('Please provide the reason for your leave');

  // Idempotent retries: a double-tap or network retry must never create a duplicate request.
  const ACTIVE = ['PENDING', 'APPROVED', 'LETTER_PENDING', 'LETTER_POSTED'] as const;
  const [dup] = await orm
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.userId, user.id), eq(leaveRequests.fromDate, input.fromDate), eq(leaveRequests.toDate, input.toDate), isNull(leaveRequests.deletedAt)))
    .limit(1);
  if (dup && (ACTIVE as readonly string[]).includes(dup.status)) return visibleLeave(dup, user);

  const [row] = await orm
    .insert(leaveRequests)
    .values({
      userId: user.id,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason.trim(),
      contact: input.contact?.trim() || null,
    })
    .returning();

  await audit({ actor: user, action: AUDIT.LEAVE_SUBMITTED, targetType: 'leave', targetId: row.id });
  // Reason is NEVER included in notifications (§36)
  await notify({
    audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
    category: 'LEAVE_SUBMITTED',
    title: 'New leave request',
    body: `${user.name} requested leave from ${input.fromDate} to ${input.toDate}`,
    entityType: 'leave',
    entityId: row.id,
  });
  return visibleLeave(row, user);
}

export async function listLeaves(viewer: AuthUser, opts: { mineOnly?: boolean } = {}) {
  if (opts.mineOnly || viewer.role === ROLES.STUDENT) {
    const rows = await orm.select().from(leaveRequests).where(and(eq(leaveRequests.userId, viewer.id), isNull(leaveRequests.deletedAt))).orderBy(desc(leaveRequests.createdAt));
    return rows.map((r) => visibleLeave(r, viewer));
  }
  if (viewer.role === ROLES.ADMIN) {
    // Least privilege: Admins see status metadata, not private reasons
    const rows = await orm.select().from(leaveRequests).where(isNull(leaveRequests.deletedAt)).orderBy(desc(leaveRequests.createdAt)).limit(500);
    return rows.map((r) => visibleLeave(r, { ...viewer, role: ROLES.ADMIN }));
  }
  const rows = await orm.select().from(leaveRequests).where(isNull(leaveRequests.deletedAt)).orderBy(desc(leaveRequests.createdAt)).limit(500);
  const userName = await userNameMap();
  return rows.map((r) => ({ ...visibleLeave(r, viewer), userName: userName[r.userId] }));
}

async function userNameMap(): Promise<Record<string, string>> {
  const rows = await orm.select({ id: users.id, name: users.name, regNo: users.regNo }).from(users).where(isNull(users.deletedAt));
  const map: Record<string, string> = {};
  for (const r of rows) map[r.id] = `${r.name}${r.regNo ? ` (${r.regNo})` : ''}`;
  return map;
}

export async function getLeave(viewer: AuthUser, id: string) {
  const [row] = await orm.select().from(leaveRequests).where(and(eq(leaveRequests.id, id), isNull(leaveRequests.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('Leave request not found');
  const isOwner = row.userId === viewer.id;
  const advisor = viewer.role === ROLES.ADVISOR;
  const rep = viewer.role === ROLES.REPRESENTATIVE;
  // Reps may see the request once the letter stage begins (they confirm the letter) — but never the reason
  if (!isOwner && !advisor && !(rep && STAFF_ONLY_STATUSES.includes(row.status))) {
    if (viewer.role === ROLES.ADMIN && row.status !== 'PENDING') {
      return { ...visibleLeave(row, viewer), documents: await docsFor(id, false) };
    }
    throw ApiError.forbidden('Leave requests are private');
  }
  const docs = await docsFor(id, isOwner || advisor || rep);
  return { ...visibleLeave(row, viewer), documents: docs };
}

async function docsFor(leaveId: string, withMeta: boolean) {
  const docs = await orm.select().from(leaveDocuments).where(eq(leaveDocuments.leaveId, leaveId));
  return docs.map((d) => ({
    id: d.id,
    fileId: withMeta ? d.fileId : 'protected',
    uploadedAt: d.uploadedAt,
    confirmedById: d.confirmedById,
    confirmedAt: d.confirmedAt,
  }));
}

/** Advisor decision (§14): ONLY the advisor approves/rejects. Approval moves the request to letter flow. */
export async function decideLeave(advisor: AuthUser, id: string, decision: 'APPROVE' | 'REJECT', note?: string) {
  if (advisor.role !== ROLES.ADVISOR) throw ApiError.forbidden('Only the Class Advisor can approve or reject leave');
  const [row] = await orm.select().from(leaveRequests).where(and(eq(leaveRequests.id, id), isNull(leaveRequests.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('Leave request not found');
  if (row.status !== 'PENDING') throw ApiError.conflict('Only pending requests can be decided');
  const status = decision === 'APPROVE' ? 'LETTER_PENDING' : 'REJECTED';
  const [updated] = await orm
    .update(leaveRequests)
    .set({ status, decidedById: advisor.id, decidedAt: new Date(), decisionNote: note, updatedAt: new Date() })
    .where(eq(leaveRequests.id, id))
    .returning();
  await audit({ actor: advisor, action: AUDIT.LEAVE_DECIDED, targetType: 'leave', targetId: id, metadata: { decision } });
  await notify({
    audience: { kind: 'users', userIds: [row.userId] },
    category: 'LEAVE_DECIDED',
    title: decision === 'APPROVE' ? 'Your leave was approved' : 'Your leave was rejected',
    body: decision === 'APPROVE' ? 'You can now post your signed leave letter.' : note || 'Contact your Class Advisor for details.',
    entityType: 'leave',
    entityId: id,
  });
  return visibleLeave(updated, advisor);
}

/** Withdrawal (§14): silently allowed while pending; after approval it becomes a REQUEST the advisor must action — never a silent cancel. */
export async function withdrawLeave(user: AuthUser, id: string) {
  const [row] = await orm.select().from(leaveRequests).where(and(eq(leaveRequests.id, id), eq(leaveRequests.userId, user.id))).limit(1);
  if (!row) throw ApiError.notFound('Leave request not found');
  if (row.status === 'PENDING') {
    const [updated] = await orm.update(leaveRequests).set({ status: 'WITHDRAWN', updatedAt: new Date() }).where(eq(leaveRequests.id, id)).returning();
    await audit({ actor: user, action: AUDIT.LEAVE_WITHDRAWN, targetType: 'leave', targetId: id });
    await notify({
      audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
      category: 'LEAVE_SUBMITTED',
      title: 'Leave request withdrawn',
      body: `${user.name} withdrew a pending leave request.`,
      entityType: 'leave',
      entityId: id,
    });
    return visibleLeave(updated, user);
  }
  if (['LETTER_PENDING', 'LETTER_POSTED'].includes(row.status)) {
    const [updated] = await orm.update(leaveRequests).set({ withdrawalRequested: true, updatedAt: new Date() }).where(eq(leaveRequests.id, id)).returning();
    await notify({
      audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
      category: 'LEAVE_WITHDRAW_REQUESTED',
      title: 'Leave withdrawal requested',
      body: `${user.name} asked to withdraw an approved leave. Review required.`,
      entityType: 'leave',
      entityId: id,
    });
    return visibleLeave(updated, user);
  }
  throw ApiError.conflict('This request can no longer be withdrawn');
}

/** Advisor actions a withdrawal request on an approved leave. */
export async function resolveWithdrawal(actor: AuthUser, id: string, approve: boolean) {
  if (actor.role !== ROLES.ADVISOR) throw ApiError.forbidden();
  const [row] = await orm.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
  if (!row || !row.withdrawalRequested) throw ApiError.badRequest('No withdrawal request pending');
  const [updated] = await orm
    .update(leaveRequests)
    .set(approve ? { status: 'WITHDRAWN', withdrawalRequested: false, updatedAt: new Date() } : { withdrawalRequested: false, updatedAt: new Date() })
    .where(eq(leaveRequests.id, id))
    .returning();
  await audit({ actor, action: approve ? AUDIT.LEAVE_WITHDRAWN : 'LEAVE_WITHDRAW_REJECTED', targetType: 'leave', targetId: id });
  await notify({
    audience: { kind: 'users', userIds: [row.userId] },
    category: 'LEAVE_DECIDED',
    title: approve ? 'Your approved leave was withdrawn' : 'Your withdrawal request was not accepted',
    body: approve ? 'The advisor cancelled the approved leave.' : 'The leave remains active. Contact your advisor.',
    entityType: 'leave',
    entityId: id,
  });
  return visibleLeave(updated, actor);
}

/** Student posts the signed leave letter into the request placeholder (§14). */
export async function postLeaveLetter(user: AuthUser, id: string, fileId: string) {
  const [row] = await orm.select().from(leaveRequests).where(and(eq(leaveRequests.id, id), eq(leaveRequests.userId, user.id))).limit(1);
  if (!row) throw ApiError.notFound('Leave request not found');
  if (row.status !== 'LETTER_PENDING') throw ApiError.conflict('Letters can only be posted after approval');
  const [doc] = await orm.insert(leaveDocuments).values({ leaveId: id, fileId, uploadedById: user.id }).returning();
  const [updated] = await orm.update(leaveRequests).set({ status: 'LETTER_POSTED', updatedAt: new Date() }).where(eq(leaveRequests.id, id)).returning();
  await audit({ actor: user, action: AUDIT.LEAVE_LETTER_POSTED, targetType: 'leave', targetId: id });
  await notify({
    audience: { kind: 'roles', roles: [ROLES.REPRESENTATIVE] },
    category: 'LEAVE_LETTER_POSTED',
    title: 'Leave letter posted',
    body: `${user.name} posted a signed leave letter — awaiting representative confirmation.`,
    entityType: 'leave',
    entityId: id,
  });
  return { leave: visibleLeave(updated, user), document: doc };
}

/** Any ONE representative confirms the signed letter (§14). Reps confirm the letter, they do NOT approve leave. */
export async function confirmLeaveLetter(rep: AuthUser, id: string) {
  if (rep.role !== ROLES.REPRESENTATIVE) throw ApiError.forbidden('Only representatives confirm leave letters');
  const [row] = await orm.select().from(leaveRequests).where(and(eq(leaveRequests.id, id), isNull(leaveRequests.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('Leave request not found');
  if (row.status !== 'LETTER_POSTED') throw ApiError.conflict('No posted letter awaiting confirmation');
  const [doc] = await orm.select().from(leaveDocuments).where(eq(leaveDocuments.leaveId, id)).limit(1);
  if (!doc) throw ApiError.conflict('No letter document found');
  await orm.update(leaveDocuments).set({ confirmedById: rep.id, confirmedAt: new Date() }).where(eq(leaveDocuments.id, doc.id));
  const [updated] = await orm.update(leaveRequests).set({ status: 'REP_CONFIRMED', updatedAt: new Date() }).where(eq(leaveRequests.id, id)).returning();
  await audit({ actor: rep, action: AUDIT.LEAVE_LETTER_CONFIRMED, targetType: 'leave', targetId: id });
  await notify({
    audience: { kind: 'users', userIds: [row.userId] },
    category: 'LEAVE_LETTER_CONFIRMED',
    title: 'Leave letter confirmed',
    body: 'A class representative confirmed your signed leave letter.',
    entityType: 'leave',
    entityId: id,
  });
  return visibleLeave(updated, rep);
}
