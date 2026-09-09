import { and, desc, eq, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { chatMessages, clearingApprovals, clearingRequests, users } from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { publishAll } from '@/server/realtime';
import { can } from '@/server/rbac';
import { fileMeta } from '@/server/files';

/**
 * §19 — Class chat clearing system.
 * A clearing request needs approval from: the Advisor + EVERY active Representative
 * + an App Administrator. With 0 representatives: Advisor + Administrator.
 * The clearing executes automatically when the required approvals are complete.
 * Every step is audit-logged.
 */

async function requiredApproverIds(): Promise<{ advisorId: string | null; repIds: string[]; adminIds: string[] }> {
  const staff = await orm
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.isActive, true)));
  return {
    advisorId: staff.find((s) => s.role === ROLES.ADVISOR)?.id ?? null,
    repIds: staff.filter((s) => s.role === ROLES.REPRESENTATIVE).map((s) => s.id),
    adminIds: staff.filter((s) => s.role === ROLES.ADMIN).map((s) => s.id),
  };
}

export function approvalRule(repCount: number) {
  return repCount === 0 ? 'ADVISOR_AND_ADMIN' : 'ADVISOR_ALL_REPS_AND_ADMIN';
}

async function maybeExecute(requestId: string, actor?: AuthUser) {
  const [req] = await orm.select().from(clearingRequests).where(eq(clearingRequests.id, requestId)).limit(1);
  if (!req || req.status !== 'PENDING') return req;
  const { advisorId, repIds, adminIds } = await requiredApproverIds();
  const approvals = await orm.select().from(clearingApprovals).where(eq(clearingApprovals.requestId, requestId));
  const approvedBy = new Set(approvals.map((a) => a.approverId));

  const advisorOk = !advisorId || approvedBy.has(advisorId);
  const repsOk = repIds.every((r) => approvedBy.has(r));
  const adminOk = adminIds.some((a) => approvedBy.has(a));

  if (advisorOk && repsOk && adminOk) {
    // Execute: soft-delete the target content (history retained in audit)
    if (req.scope === 'CLASS_CHAT_MESSAGE' || req.scope === 'CLASS_CHAT_FILE') {
      await orm
        .update(chatMessages)
        .set({ deletedAt: new Date(), deletedById: actor?.id ?? null, deleteNote: `Cleared via clearing request ${req.id}` })
        .where(eq(chatMessages.id, req.targetId));
    }
    const [updated] = await orm
      .update(clearingRequests)
      .set({ status: 'EXECUTED', executedAt: new Date() })
      .where(eq(clearingRequests.id, requestId))
      .returning();
    await audit({ actor, action: AUDIT.CLEARING_EXECUTED, targetType: 'clearing_request', targetId: requestId });
    await notify({
      audience: { kind: 'roles', roles: [ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN] },
      category: 'CLEARING_EXECUTED',
      title: 'Chat clearing executed',
      body: `Clearing request for "${req.targetPreview.slice(0, 60)}" completed with all approvals.`,
      entityType: 'clearing',
      entityId: requestId,
    });
    publishAll({ type: 'chat', topic: 'chat:CLASS:class' });
    return updated;
  }
  return req;
}

export async function createClearingRequest(actor: AuthUser, input: { scope: 'CLASS_CHAT_MESSAGE' | 'CLASS_CHAT_FILE'; targetId: string; reason: string }) {
  if (!can.requestClearing(actor)) throw ApiError.forbidden();
  const [msg] = await orm.select().from(chatMessages).where(eq(chatMessages.id, input.targetId)).limit(1);
  if (!msg || msg.deletedAt) throw ApiError.badRequest('Target message not found or already cleared');
  if (!msg.threadType || msg.threadType !== 'CLASS') throw ApiError.badRequest('Clearing requests apply to class chat content');
  if (msg.fileId && input.scope === 'CLASS_CHAT_MESSAGE') throw ApiError.badRequest('This message contains a file — request a CLASS_CHAT_FILE clearing instead');

  let preview = msg.body?.slice(0, 120) || '';
  if (input.scope === 'CLASS_CHAT_FILE') {
    const meta = msg.fileId ? await fileMeta(msg.fileId) : null;
    preview = meta ? `File: ${meta.fileName}` : 'File attachment';
  }
  const [row] = await orm
    .insert(clearingRequests)
    .values({
      scope: input.scope,
      targetId: input.targetId,
      targetPreview: preview || '(file message)',
      reason: input.reason.trim(),
      requestedById: actor.id,
    })
    .returning();
  await audit({ actor, action: AUDIT.CLEARING_REQUESTED, targetType: 'clearing_request', targetId: row.id, metadata: { scope: input.scope, target: input.targetId } });
  await notify({
    audience: { kind: 'roles', roles: [ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN] },
    category: 'CLEARING_REQUEST',
    title: 'Chat clearing requested',
    body: `${actor.name} requested clearing of "${preview.slice(0, 50)}"`,
    entityType: 'clearing',
    entityId: row.id,
    excludeUserIds: [actor.id],
  });
  return row;
}

export async function approveClearing(actor: AuthUser, requestId: string, note?: string) {
  if (!can.approveClearing(actor)) throw ApiError.forbidden();
  const [req] = await orm.select().from(clearingRequests).where(eq(clearingRequests.id, requestId)).limit(1);
  if (!req || req.status !== 'PENDING') throw ApiError.badRequest('Request is not pending');
  await orm
    .insert(clearingApprovals)
    .values({ requestId, approverId: actor.id, approverRole: actor.role, decision: 'APPROVED', note })
    .onConflictDoNothing();
  await audit({ actor, action: AUDIT.CLEARING_APPROVED, targetType: 'clearing_request', targetId: requestId });
  return maybeExecute(requestId, actor);
}

export async function cancelClearing(actor: AuthUser, requestId: string) {
  const [req] = await orm.select().from(clearingRequests).where(eq(clearingRequests.id, requestId)).limit(1);
  if (!req) throw ApiError.notFound();
  const allowed = req.requestedById === actor.id || actor.role === ROLES.ADVISOR || actor.role === ROLES.ADMIN;
  if (!allowed) throw ApiError.forbidden();
  if (req.status !== 'PENDING') throw ApiError.badRequest('Request is not pending');
  await orm.update(clearingRequests).set({ status: 'CANCELLED' }).where(eq(clearingRequests.id, requestId));
  await audit({ actor, action: AUDIT.CLEARING_CANCELLED, targetType: 'clearing_request', targetId: requestId });
  return { ok: true };
}

export async function listClearingRequests(viewer: AuthUser) {
  if (!can.requestClearing(viewer)) throw ApiError.forbidden();
  const { advisorId, repIds, adminIds } = await requiredApproverIds();
  const rows = await orm.select().from(clearingRequests).orderBy(desc(clearingRequests.createdAt)).limit(100);
  const approvals = await orm.select().from(clearingApprovals);
  const names = await orm.select({ id: users.id, name: users.name }).from(users);
  const nameMap = new Map(names.map((n) => [n.id, n.name]));

  return rows.map((r) => {
    const mine = approvals.filter((a) => a.requestId === r.id);
    const approvedBy = new Set(mine.map((a) => a.approverId));
    const needAdvisor = advisorId ? !approvedBy.has(advisorId) : false;
    const needReps = repIds.filter((id) => !approvedBy.has(id));
    const needAdmin = !adminIds.some((id) => approvedBy.has(id));
    return {
      id: r.id,
      scope: r.scope,
      targetPreview: r.targetPreview,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      executedAt: r.executedAt,
      requestedByName: nameMap.get(r.requestedById) || '—',
      approvals: mine.map((a) => ({ approverName: nameMap.get(a.approverId) || '—', approverRole: a.approverRole, at: a.createdAt })),
      pendingFrom: {
        advisor: needAdvisor,
        representatives: needReps.length,
        admin: needAdmin,
      },
    };
  });
}

/** For tests + admin UI: whether a request has everything it needs. */
export async function clearingState(requestId: string) {
  const [req] = await orm.select().from(clearingRequests).where(eq(clearingRequests.id, requestId)).limit(1);
  if (!req) throw ApiError.notFound();
  const { advisorId, repIds, adminIds } = await requiredApproverIds();
  const approvals = await orm.select().from(clearingApprovals).where(eq(clearingApprovals.requestId, requestId));
  const approvedBy = new Set(approvals.map((a) => a.approverId));
  return {
    request: req,
    rule: approvalRule(repIds.length),
    satisfied:
      (!advisorId || approvedBy.has(advisorId)) &&
      repIds.every((r) => approvedBy.has(r)) &&
      adminIds.some((a) => approvedBy.has(a)),
    approvals,
  };
}
