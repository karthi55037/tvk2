import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { assignmentItems, chatMessages, chatReports, experiments, users } from '@/drizzle/schema';
import { CLASS_THREAD, EMOJI_RE, ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { publishAll } from '@/server/realtime';
import { can } from '@/server/rbac';

export type ThreadRef = { threadType: 'CLASS' | 'ASSIGNMENT' | 'EXPERIMENT'; threadId: string };

async function assertThread(ref: ThreadRef) {
  if (ref.threadType === 'CLASS') {
    if (ref.threadId !== CLASS_THREAD) throw ApiError.notFound('Chat not found');
    return;
  }
  if (ref.threadType === 'ASSIGNMENT') {
    const [item] = await orm.select().from(assignmentItems).where(and(eq(assignmentItems.id, ref.threadId), isNull(assignmentItems.deletedAt))).limit(1);
    if (!item) throw ApiError.notFound('Assignment chat not found');
    return;
  }
  const [exp] = await orm.select().from(experiments).where(and(eq(experiments.id, ref.threadId), isNull(experiments.deletedAt))).limit(1);
  if (!exp) throw ApiError.notFound('Experiment chat not found');
}

export async function listMessages(viewer: AuthUser, ref: ThreadRef, after?: string) {
  await assertThread(ref);
  const rows = await orm
    .select({
      id: chatMessages.id,
      body: chatMessages.body,
      fileId: chatMessages.fileId,
      createdAt: chatMessages.createdAt,
      deletedAt: chatMessages.deletedAt,
      userId: chatMessages.userId,
      userName: users.name,
      userRole: users.role,
      userRegNo: users.regNo,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.userId, users.id))
    .where(
      after
        ? and(eq(chatMessages.threadType, ref.threadType), eq(chatMessages.threadId, ref.threadId), gt(chatMessages.createdAt, new Date(after)))
        : and(eq(chatMessages.threadType, ref.threadType), eq(chatMessages.threadId, ref.threadId)),
    )
    .orderBy(asc(chatMessages.createdAt))
    .limit(200);
  // Display identity always comes from the registered profile (§17) — never user-editable
  return rows.map((r) => ({
    id: r.id,
    body: r.deletedAt ? null : r.body,
    fileId: r.deletedAt ? null : r.fileId,
    createdAt: r.createdAt,
    deleted: Boolean(r.deletedAt),
    author: { id: r.userId, name: r.userName, role: r.userRole, regNo: r.userRegNo },
  }));
}

export async function postMessage(user: AuthUser, ref: ThreadRef, input: { body?: string; fileId?: string }) {
  await assertThread(ref);
  const body = input.body?.trim() || '';
  const fileId = input.fileId;
  if (!body && !fileId) throw ApiError.badRequest('Message cannot be empty');
  if (body.length > 2000) throw ApiError.badRequest('Message is too long (max 2000 characters)');
  if (ref.threadType === 'CLASS' && EMOJI_RE.test(body)) {
    throw ApiError.badRequest('The class chat is text-only — emojis are not allowed');
  }
  const [row] = await orm
    .insert(chatMessages)
    .values({ threadType: ref.threadType, threadId: ref.threadId, userId: user.id, body: body || null, fileId: fileId || null })
    .returning();

  await audit({ actor: user, action: AUDIT.CHAT_MESSAGE_POSTED, targetType: 'chat_message', targetId: row.id, metadata: { thread: `${ref.threadType}:${ref.threadId}` } });

  // Real-time hint (no content, privacy-safe) — clients refetch
  publishAll({ type: 'chat', topic: `chat:${ref.threadType}:${ref.threadId}` });

  // New class-chat message notifications respect personal preferences (§31)
  if (ref.threadType === 'CLASS') {
    await notify({
      audience: { kind: 'roles', roles: [ROLES.STUDENT, ROLES.REPRESENTATIVE, ROLES.ADVISOR, ROLES.ADMIN] },
      category: 'CHAT_MESSAGE',
      title: 'New class chat message',
      body: `${user.name} sent a message in the class chat`,
      entityType: 'chat',
      entityId: 'class',
      excludeUserIds: [user.id],
    });
  }
  return row;
}

/**
 * §17/§19: class-chat deletion happens ONLY through the clearing-approval flow.
 * The single documented emergency mechanism (§19): an App Administrator takedown
 * for serious violations — always audit-logged and surfaced to Advisor.
 */
export async function emergencyTakedown(admin: AuthUser, messageId: string, note: string) {
  if (!can.emergencyTakedown(admin)) throw ApiError.forbidden('Only App Administrators can perform emergency takedowns');
  const [row] = await orm.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
  if (!row || row.deletedAt) throw ApiError.notFound('Message not found');
  if (row.threadType !== 'CLASS') throw ApiError.badRequest('Emergency takedown applies to class chat only');
  await orm
    .update(chatMessages)
    .set({ deletedAt: new Date(), deletedById: admin.id, deleteNote: note || 'Emergency moderation' })
    .where(eq(chatMessages.id, messageId));
  await audit({ actor: admin, action: AUDIT.CHAT_EMERGENCY_TAKEDOWN, targetType: 'chat_message', targetId: messageId, metadata: { note } });
  await notify({
    audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
    category: 'REPORT_SUBMITTED',
    title: 'Emergency chat takedown',
    body: `An administrator removed a class-chat message. Note: ${note}`,
    entityType: 'chat_message',
    entityId: messageId,
  });
  publishAll({ type: 'chat', topic: `chat:CLASS:${row.threadId}` });
  return { ok: true };
}

/** Deletion inside assignment/experiment chats: Advisor/Admin moderation, audit-logged (separate lifecycle, §24). */
export async function moderateThreadMessage(actor: AuthUser, messageId: string, note: string) {
  if (actor.role !== ROLES.ADVISOR && actor.role !== ROLES.ADMIN) throw ApiError.forbidden();
  const [row] = await orm.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
  if (!row || row.deletedAt) throw ApiError.notFound('Message not found');
  if (row.threadType === 'CLASS') throw ApiError.badRequest('Class chat deletion requires the clearing approval flow');
  await orm
    .update(chatMessages)
    .set({ deletedAt: new Date(), deletedById: actor.id, deleteNote: note || 'Moderation' })
    .where(eq(chatMessages.id, messageId));
  await audit({ actor, action: AUDIT.CHAT_MESSAGE_CLEARED, targetType: 'chat_message', targetId: messageId, metadata: { thread: `${row.threadType}:${row.threadId}` } });
  publishAll({ type: 'chat', topic: `chat:${row.threadType}:${row.threadId}` });
  return { ok: true };
}

// ------------------------------------------------------------------ reports (§18)

export async function reportMessage(reporter: AuthUser, input: { messageId: string; category: string; description?: string }) {
  if (!can.reportChat(reporter)) throw ApiError.forbidden('Only representatives and staff can report chat content');
  const [msg] = await orm.select().from(chatMessages).where(eq(chatMessages.id, input.messageId)).limit(1);
  if (!msg) throw ApiError.notFound('Message not found');
  const [row] = await orm
    .insert(chatReports)
    .values({
      messageId: input.messageId,
      reportedById: reporter.id,
      category: input.category,
      description: input.description,
    })
    .returning();
  await audit({ actor: reporter, action: AUDIT.CHAT_REPORTED, targetType: 'chat_message', targetId: input.messageId, metadata: { category: input.category } });
  await notify({
    audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
    category: 'REPORT_SUBMITTED',
    title: 'Chat content reported',
    body: `${reporter.name} reported a class-chat message (${input.category})`,
    entityType: 'chat_report',
    entityId: row.id,
  });
  return row;
}

export async function listReports(viewer: AuthUser, status?: string) {
  if (viewer.role !== ROLES.ADVISOR && viewer.role !== ROLES.ADMIN) throw ApiError.forbidden();
  const rows = await orm
    .select({
      id: chatReports.id,
      messageId: chatReports.messageId,
      category: chatReports.category,
      description: chatReports.description,
      status: chatReports.status,
      createdAt: chatReports.createdAt,
      resolvedAt: chatReports.resolvedAt,
      resolutionNote: chatReports.resolutionNote,
      reportedBy: users.name,
      msgBody: chatMessages.body,
      msgFileId: chatMessages.fileId,
      msgDeletedAt: chatMessages.deletedAt,
      msgThreadType: chatMessages.threadType,
    })
    .from(chatReports)
    .innerJoin(chatMessages, eq(chatReports.messageId, chatMessages.id))
    .innerJoin(users, eq(chatReports.reportedById, users.id))
    .where(status ? eq(chatReports.status, status as 'OPEN' | 'RESOLVED' | 'DISMISSED') : undefined)
    .orderBy(asc(chatReports.createdAt))
    .limit(200);
  return rows;
}

export async function resolveReport(actor: AuthUser, id: string, outcome: 'RESOLVED' | 'DISMISSED', note?: string) {
  if (!can.resolveReport(actor)) throw ApiError.forbidden();
  const [row] = await orm
    .update(chatReports)
    .set({ status: outcome, resolvedById: actor.id, resolvedAt: new Date(), resolutionNote: note })
    .where(eq(chatReports.id, id))
    .returning();
  if (!row) throw ApiError.notFound();
  await audit({ actor, action: AUDIT.REPORT_RESOLVED, targetType: 'chat_report', targetId: id, metadata: { outcome } });
  return row;
}
