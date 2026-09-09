import { and, desc, eq, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { odDocuments, odRequests, users } from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { isValidDateStr, isValidTimeStr } from '@/lib/dates';

function visibleOD(row: typeof odRequests.$inferSelect, viewer: AuthUser) {
  const isOwner = row.userId === viewer.id;
  const isAdvisor = viewer.role === ROLES.ADVISOR;
  const base = {
    id: row.id,
    userId: row.userId,
    programName: row.programName,
    place: row.place,
    date: row.date,
    fromTime: row.fromTime,
    toTime: row.toTime,
    status: row.status,
    withdrawalRequested: row.withdrawalRequested,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
  };
  if (isOwner || isAdvisor) return { ...base, reason: row.reason }; // OD reason/details private (§15/§36)
  return base;
}

async function userNameMap(): Promise<Record<string, string>> {
  const rows = await orm.select({ id: users.id, name: users.name, regNo: users.regNo }).from(users).where(isNull(users.deletedAt));
  const map: Record<string, string> = {};
  for (const r of rows) map[r.id] = `${r.name}${r.regNo ? ` (${r.regNo})` : ''}`;
  return map;
}

export async function submitOD(user: AuthUser, input: {
  programName: string;
  place: string;
  date: string;
  fromTime: string;
  toTime: string;
  reason: string;
}) {
  if (user.role !== ROLES.STUDENT) throw ApiError.forbidden('OD requests are for students');
  if (!input.programName.trim()) throw ApiError.badRequest('Program/event name is required');
  if (!input.place.trim()) throw ApiError.badRequest('Place is required');
  if (!isValidDateStr(input.date)) throw ApiError.badRequest('Invalid date');
  if (!isValidTimeStr(input.fromTime) || !isValidTimeStr(input.toTime)) throw ApiError.badRequest('Times must be HH:mm');
  if (input.toTime <= input.fromTime) throw ApiError.badRequest('End time must be after start time');
  if (!input.reason.trim()) throw ApiError.badRequest('Please provide the reason');

  // Idempotent retries: a double-tap or network retry must never create a duplicate request.
  const ACTIVE = ['PENDING', 'LETTER_REQUIRED', 'LETTER_POSTED'] as const;
  const [dup] = await orm
    .select()
    .from(odRequests)
    .where(and(eq(odRequests.userId, user.id), eq(odRequests.date, input.date), eq(odRequests.programName, input.programName.trim()), isNull(odRequests.deletedAt)))
    .limit(1);
  if (dup && (ACTIVE as readonly string[]).includes(dup.status)) return visibleOD(dup, user);

  const [row] = await orm
    .insert(odRequests)
    .values({
      userId: user.id,
      programName: input.programName.trim(),
      place: input.place.trim(),
      date: input.date,
      fromTime: input.fromTime,
      toTime: input.toTime,
      reason: input.reason.trim(),
    })
    .returning();

  await audit({ actor: user, action: AUDIT.OD_SUBMITTED, targetType: 'od', targetId: row.id });
  await notify({
    audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
    category: 'OD_SUBMITTED',
    title: 'New OD request',
    body: `${user.name} requested OD for "${input.programName.trim()}" on ${input.date}`,
    entityType: 'od',
    entityId: row.id,
  });
  // Representatives are notified of the OD request, but they do NOT approve it (§15)
  await notify({
    audience: { kind: 'roles', roles: [ROLES.REPRESENTATIVE] },
    category: 'OD_SUBMITTED',
    title: 'OD request submitted',
    body: `${user.name} submitted an OD request for ${input.date}`,
    entityType: 'od',
    entityId: row.id,
  });
  return visibleOD(row, user);
}

export async function listODs(viewer: AuthUser, opts: { mineOnly?: boolean } = {}) {
  if (opts.mineOnly || viewer.role === ROLES.STUDENT) {
    const rows = await orm.select().from(odRequests).where(and(eq(odRequests.userId, viewer.id), isNull(odRequests.deletedAt))).orderBy(desc(odRequests.createdAt));
    return rows.map((r) => visibleOD(r, viewer));
  }
  if (viewer.role === ROLES.ADMIN) {
    const rows = await orm.select().from(odRequests).where(isNull(odRequests.deletedAt)).orderBy(desc(odRequests.createdAt)).limit(500);
    return rows.map((r) => visibleOD(r, viewer));
  }
  const rows = await orm.select().from(odRequests).where(isNull(odRequests.deletedAt)).orderBy(desc(odRequests.createdAt)).limit(500);
  const names = await userNameMap();
  return rows.map((r) => ({ ...visibleOD(r, viewer), userName: names[r.userId] }));
}

export async function getOD(viewer: AuthUser, id: string) {
  const [row] = await orm.select().from(odRequests).where(and(eq(odRequests.id, id), isNull(odRequests.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('OD request not found');
  const isOwner = row.userId === viewer.id;
  const advisor = viewer.role === ROLES.ADVISOR;
  const rep = viewer.role === ROLES.REPRESENTATIVE;
  const letterStage = ['LETTER_POSTED', 'REP_CONFIRMED'].includes(row.status);
  if (!isOwner && !advisor && !(rep && letterStage)) {
    if (viewer.role === ROLES.ADMIN && row.status !== 'PENDING') {
      const docs = await orm.select().from(odDocuments).where(eq(odDocuments.odId, id));
      return { ...visibleOD(row, viewer), documents: docs.map((d) => ({ id: d.id, fileId: 'protected', uploadedAt: d.uploadedAt, confirmedAt: d.confirmedAt })) };
    }
    throw ApiError.forbidden('OD requests are private');
  }
  const docs = await orm.select().from(odDocuments).where(eq(odDocuments.odId, id));
  return {
    ...visibleOD(row, viewer),
    documents: docs.map((d) => ({ id: d.id, fileId: d.fileId, uploadedAt: d.uploadedAt, confirmedById: d.confirmedById, confirmedAt: d.confirmedAt })),
  };
}

/** Only the Advisor approves/rejects OD (§15). Approval => letter required (no letter at submission). */
export async function decideOD(advisor: AuthUser, id: string, decision: 'APPROVE' | 'REJECT', note?: string) {
  if (advisor.role !== ROLES.ADVISOR) throw ApiError.forbidden('Only the Class Advisor can approve or reject OD');
  const [row] = await orm.select().from(odRequests).where(and(eq(odRequests.id, id), isNull(odRequests.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('OD request not found');
  if (row.status !== 'PENDING') throw ApiError.conflict('Only pending requests can be decided');
  const status = decision === 'APPROVE' ? 'LETTER_REQUIRED' : 'REJECTED';
  const [updated] = await orm
    .update(odRequests)
    .set({ status, decidedById: advisor.id, decidedAt: new Date(), decisionNote: note, updatedAt: new Date() })
    .where(eq(odRequests.id, id))
    .returning();
  await audit({ actor: advisor, action: AUDIT.OD_DECIDED, targetType: 'od', targetId: id, metadata: { decision } });
  await notify({
    audience: { kind: 'users', userIds: [row.userId] },
    category: 'OD_DECIDED',
    title: decision === 'APPROVE' ? 'Your OD was approved' : 'Your OD was rejected',
    body: decision === 'APPROVE' ? 'Please prepare the OD letter and post it after HOD signing.' : note || 'Contact your Class Advisor for details.',
    entityType: 'od',
    entityId: id,
  });
  return visibleOD(updated, advisor);
}

export async function withdrawOD(user: AuthUser, id: string) {
  const [row] = await orm.select().from(odRequests).where(and(eq(odRequests.id, id), eq(odRequests.userId, user.id))).limit(1);
  if (!row) throw ApiError.notFound('OD request not found');
  if (row.status === 'PENDING') {
    const [updated] = await orm.update(odRequests).set({ status: 'WITHDRAWN', updatedAt: new Date() }).where(eq(odRequests.id, id)).returning();
    await audit({ actor: user, action: AUDIT.OD_WITHDRAWN, targetType: 'od', targetId: id });
    await notify({
      audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
      category: 'OD_SUBMITTED',
      title: 'OD request withdrawn',
      body: `${user.name} withdrew a pending OD request.`,
      entityType: 'od',
      entityId: id,
    });
    return visibleOD(updated, user);
  }
  if (['LETTER_REQUIRED', 'LETTER_POSTED'].includes(row.status)) {
    const [updated] = await orm.update(odRequests).set({ withdrawalRequested: true, updatedAt: new Date() }).where(eq(odRequests.id, id)).returning();
    await notify({
      audience: { kind: 'roles', roles: [ROLES.ADVISOR] },
      category: 'OD_WITHDRAW_REQUESTED',
      title: 'OD withdrawal requested',
      body: `${user.name} asked to withdraw an approved OD. Review required.`,
      entityType: 'od',
      entityId: id,
    });
    return visibleOD(updated, user);
  }
  throw ApiError.conflict('This request can no longer be withdrawn');
}

export async function resolveODWithdrawal(actor: AuthUser, id: string, approve: boolean) {
  if (actor.role !== ROLES.ADVISOR) throw ApiError.forbidden();
  const [row] = await orm.select().from(odRequests).where(eq(odRequests.id, id)).limit(1);
  if (!row || !row.withdrawalRequested) throw ApiError.badRequest('No withdrawal request pending');
  const [updated] = await orm
    .update(odRequests)
    .set(approve ? { status: 'WITHDRAWN', withdrawalRequested: false, updatedAt: new Date() } : { withdrawalRequested: false, updatedAt: new Date() })
    .where(eq(odRequests.id, id))
    .returning();
  await audit({ actor, action: approve ? AUDIT.OD_WITHDRAWN : 'OD_WITHDRAW_REJECTED', targetType: 'od', targetId: id });
  return visibleOD(updated, actor);
}

/** Student posts the completed (HOD-signed) OD letter — never required at request time (§15). */
export async function postODLetter(user: AuthUser, id: string, fileId: string) {
  const [row] = await orm.select().from(odRequests).where(and(eq(odRequests.id, id), eq(odRequests.userId, user.id))).limit(1);
  if (!row) throw ApiError.notFound('OD request not found');
  if (row.status !== 'LETTER_REQUIRED') throw ApiError.conflict('Letters can only be posted after approval');
  const [doc] = await orm.insert(odDocuments).values({ odId: id, fileId, uploadedById: user.id }).returning();
  const [updated] = await orm.update(odRequests).set({ status: 'LETTER_POSTED', updatedAt: new Date() }).where(eq(odRequests.id, id)).returning();
  await audit({ actor: user, action: AUDIT.OD_LETTER_POSTED, targetType: 'od', targetId: id });
  await notify({
    audience: { kind: 'roles', roles: [ROLES.REPRESENTATIVE] },
    category: 'OD_LETTER_POSTED',
    title: 'OD letter posted',
    body: `${user.name} posted the OD letter for "${row.programName}" — awaiting confirmation.`,
    entityType: 'od',
    entityId: id,
  });
  return { od: visibleOD(updated, user), document: doc };
}

/** Representative CONFIRMS letter completion — this is not OD approval (§15). Any one rep is enough. */
export async function confirmODLetter(rep: AuthUser, id: string) {
  if (rep.role !== ROLES.REPRESENTATIVE) throw ApiError.forbidden('Only representatives confirm OD letters');
  const [row] = await orm.select().from(odRequests).where(and(eq(odRequests.id, id), isNull(odRequests.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('OD request not found');
  if (row.status !== 'LETTER_POSTED') throw ApiError.conflict('No posted letter awaiting confirmation');
  const [doc] = await orm.select().from(odDocuments).where(eq(odDocuments.odId, id)).limit(1);
  if (!doc) throw ApiError.conflict('No letter document found');
  await orm.update(odDocuments).set({ confirmedById: rep.id, confirmedAt: new Date() }).where(eq(odDocuments.id, doc.id));
  const [updated] = await orm.update(odRequests).set({ status: 'REP_CONFIRMED', updatedAt: new Date() }).where(eq(odRequests.id, id)).returning();
  await audit({ actor: rep, action: AUDIT.OD_LETTER_CONFIRMED, targetType: 'od', targetId: id });
  await notify({
    audience: { kind: 'users', userIds: [row.userId] },
    category: 'OD_LETTER_CONFIRMED',
    title: 'OD letter confirmed',
    body: 'A class representative confirmed your OD letter.',
    entityType: 'od',
    entityId: id,
  });
  return visibleOD(updated, rep);
}
