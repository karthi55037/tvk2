import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { orm } from '@/server/db';
import { experimentCompletions, experimentRecords, experimentResources, experiments, subjects, users } from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { can } from '@/server/rbac';
import { publishAll } from '@/server/realtime';

/** Record & Observation is organized Subject → Experiments (§25) — never Record 1..N. */
export async function listSubjectsWithExperiments() {
  const subjectRows = await orm.select().from(subjects).where(isNull(subjects.deletedAt)).orderBy(asc(subjects.name));
  const expRows = await orm
    .select({ id: experiments.id, subjectId: experiments.subjectId, number: experiments.number, name: experiments.name })
    .from(experiments)
    .where(isNull(experiments.deletedAt))
    .orderBy(asc(experiments.number));
  return subjectRows.map((s) => ({ ...s, experiments: expRows.filter((e) => e.subjectId === s.id) }));
}

export async function listExperiments(subjectId: string) {
  return orm
    .select()
    .from(experiments)
    .where(and(eq(experiments.subjectId, subjectId), isNull(experiments.deletedAt)))
    .orderBy(asc(experiments.number));
}

export async function createExperiment(actor: AuthUser, input: {
  subjectId: string;
  number?: number;
  name: string;
  details?: string;
  instructions?: string;
  requiredFilesNote?: string;
}) {
  if (!can.manageExperiments(actor)) throw ApiError.forbidden();
  const [subject] = await orm.select().from(subjects).where(and(eq(subjects.id, input.subjectId), isNull(subjects.deletedAt))).limit(1);
  if (!subject) throw ApiError.badRequest('Unknown subject');
  let number = input.number;
  if (!number) {
    const [max] = await orm
      .select({ n: sql<number>`coalesce(max(${experiments.number}), 0)` })
      .from(experiments)
      .where(and(eq(experiments.subjectId, input.subjectId), isNull(experiments.deletedAt)));
    number = Number(max?.n ?? 0) + 1;
  }
  const [dup] = await orm
    .select()
    .from(experiments)
    .where(and(eq(experiments.subjectId, input.subjectId), eq(experiments.number, number), isNull(experiments.deletedAt)))
    .limit(1);
  if (dup) throw ApiError.conflict(`Experiment ${number} already exists for ${subject.name}`);
  const [row] = await orm
    .insert(experiments)
    .values({
      subjectId: input.subjectId,
      number,
      name: input.name.trim(),
      details: input.details,
      instructions: input.instructions,
      requiredFilesNote: input.requiredFilesNote,
      createdById: actor.id,
    })
    .returning();
  await audit({ actor, action: AUDIT.EXPERIMENT_CREATED, targetType: 'experiment', targetId: row.id, metadata: { subject: subject.code, number } });
  publishAll({ type: 'refresh', topic: 'experiments' });
  return row;
}

export async function updateExperiment(actor: AuthUser, id: string, patch: Partial<{ name: string; details: string; instructions: string; requiredFilesNote: string | null; number: number }>) {
  if (!can.manageExperiments(actor)) throw ApiError.forbidden();
  const [row] = await orm.select().from(experiments).where(and(eq(experiments.id, id), isNull(experiments.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('Experiment not found');
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ['name', 'details', 'instructions', 'requiredFilesNote'] as const) {
    if (patch[k] !== undefined) updates[k] = patch[k];
  }
  if (patch.number !== undefined) {
    const [dup] = await orm
      .select()
      .from(experiments)
      .where(and(eq(experiments.subjectId, row.subjectId), eq(experiments.number, patch.number), isNull(experiments.deletedAt)))
      .limit(1);
    if (dup && dup.id !== id) throw ApiError.conflict('Another experiment already has that number');
    updates.number = patch.number;
  }
  await orm.update(experiments).set(updates).where(eq(experiments.id, id));
  await audit({ actor, action: AUDIT.EXPERIMENT_UPDATED, targetType: 'experiment', targetId: id });
  publishAll({ type: 'refresh', topic: 'experiments' });
  return { id };
}

export async function deleteExperiment(actor: AuthUser, id: string) {
  if (!can.manageExperiments(actor)) throw ApiError.forbidden();
  const [row] = await orm.update(experiments).set({ deletedAt: new Date() }).where(and(eq(experiments.id, id), isNull(experiments.deletedAt))).returning();
  if (!row) throw ApiError.notFound('Experiment not found');
  await audit({ actor, action: AUDIT.EXPERIMENT_DELETED, targetType: 'experiment', targetId: id });
  publishAll({ type: 'refresh', topic: 'experiments' });
  return { ok: true };
}

export async function getExperiment(id: string) {
  const [row] = await orm
    .select({
      id: experiments.id,
      subjectId: experiments.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      number: experiments.number,
      name: experiments.name,
      details: experiments.details,
      instructions: experiments.instructions,
      requiredFilesNote: experiments.requiredFilesNote,
    })
    .from(experiments)
    .innerJoin(subjects, eq(experiments.subjectId, subjects.id))
    .where(and(eq(experiments.id, id), isNull(experiments.deletedAt)))
    .limit(1);
  if (!row) throw ApiError.notFound('Experiment not found');
  return row;
}

// ---------------------------------------------------------------- completion (§26)

export async function setCompletion(actor: AuthUser, experimentId: string, targetUserId: string, status: 'COMPLETED' | 'NOT_COMPLETED') {
  const [exp] = await orm.select().from(experiments).where(and(eq(experiments.id, experimentId), isNull(experiments.deletedAt))).limit(1);
  if (!exp) throw ApiError.notFound('Experiment not found');
  const self = actor.id === targetUserId;
  if (self) {
    if (actor.role !== ROLES.STUDENT && actor.role !== ROLES.REPRESENTATIVE) throw ApiError.forbidden('Only students mark their own completion');
  } else if (!can.manageExperiments(actor)) {
    throw ApiError.forbidden('Only representatives/advisor/admin can change another student\'s completion status');
  }
  const values = { experimentId, userId: targetUserId, status, updatedById: actor.id, updatedAt: new Date() };
  const [row] = await orm
    .insert(experimentCompletions)
    .values(values)
    .onConflictDoUpdate({ target: [experimentCompletions.experimentId, experimentCompletions.userId], set: values })
    .returning();
  await audit({ actor, action: AUDIT.EXPERIMENT_COMPLETION, targetType: 'experiment', targetId: experimentId, metadata: { student: targetUserId, status } });
  publishAll({ type: 'refresh', topic: `experiment:${experimentId}` });
  return row;
}

export async function getCompletions(viewer: AuthUser, experimentId: string) {
  await getExperiment(experimentId);
  const students = await orm
    .select({ id: users.id, name: users.name, regNo: users.regNo })
    .from(users)
    .where(and(inArray(users.role, [ROLES.STUDENT, ROLES.REPRESENTATIVE]), isNull(users.deletedAt), eq(users.isActive, true)))
    .orderBy(asc(users.regNo));
  const comps = await orm.select().from(experimentCompletions).where(eq(experimentCompletions.experimentId, experimentId));
  const records = await orm.select().from(experimentRecords).where(eq(experimentRecords.experimentId, experimentId));
  return students.map((s) => {
    const c = comps.find((x) => x.userId === s.id);
    const r = records.find((x) => x.userId === s.id);
    return {
      userId: s.id,
      name: s.name,
      regNo: s.regNo,
      completion: c?.status ?? null,
      recordStatus: r?.status ?? null,
      recordFileId: viewer.role !== ROLES.STUDENT || r?.userId === viewer.id ? r?.fileId ?? null : null, // verifiers + owner
    };
  });
}

// ---------------------------------------------------------------- record files (§27)

/** Student uploads their record file. Re-upload resets verification (audit-logged). */
export async function uploadRecord(actor: AuthUser, experimentId: string, fileId: string, note?: string) {
  if (actor.role !== ROLES.STUDENT && actor.role !== ROLES.REPRESENTATIVE) throw ApiError.forbidden('Only students upload record files');
  const [exp] = await orm.select().from(experiments).where(and(eq(experiments.id, experimentId), isNull(experiments.deletedAt))).limit(1);
  if (!exp) throw ApiError.notFound('Experiment not found');
  const [existing] = await orm
    .select()
    .from(experimentRecords)
    .where(and(eq(experimentRecords.experimentId, experimentId), eq(experimentRecords.userId, actor.id)))
    .limit(1);
  let row: typeof experimentRecords.$inferSelect;
  if (existing) {
    [row] = await orm
      .update(experimentRecords)
      .set({ fileId, note, status: 'PENDING', verifiedById: null, verifiedAt: null, verificationNote: null, updatedAt: new Date() })
      .where(eq(experimentRecords.id, existing.id))
      .returning();
  } else {
    [row] = await orm.insert(experimentRecords).values({ experimentId, userId: actor.id, fileId, note }).returning();
  }
  await audit({ actor, action: AUDIT.RECORD_UPLOADED, targetType: 'experiment', targetId: experimentId, metadata: { file: fileId, reUpload: Boolean(existing) } });
  await notify({
    audience: { kind: 'roles', roles: [ROLES.REPRESENTATIVE] },
    category: 'EXPERIMENT_VERIFIED',
    title: 'Record file awaiting verification',
    body: `${actor.name} uploaded a record for Experiment ${exp.number}`,
    entityType: 'experiment',
    entityId: experimentId,
    excludeUserIds: [actor.id],
  });
  return row;
}

/** Any ONE authorized verifier verifies (§27): Representative, Advisor or Admin. */
export async function verifyRecord(actor: AuthUser, experimentId: string, studentId: string, decision: 'VERIFIED' | 'REJECTED', note?: string) {
  if (!can.verifyRecord(actor)) throw ApiError.forbidden('Only representatives/advisor/admin verify record files');
  const [row] = await orm
    .select()
    .from(experimentRecords)
    .where(and(eq(experimentRecords.experimentId, experimentId), eq(experimentRecords.userId, studentId)))
    .limit(1);
  if (!row) throw ApiError.notFound('No record file uploaded by this student');
  if (row.status === 'PENDING' && decision === 'VERIFIED') {
    // ok
  } else if (row.status !== 'PENDING') {
    throw ApiError.conflict('Record already has a final verification');
  }
  const [updated] = await orm
    .update(experimentRecords)
    .set({ status: decision, verifiedById: actor.id, verifiedAt: new Date(), verificationNote: note })
    .where(eq(experimentRecords.id, row.id))
    .returning();
  await audit({ actor, action: AUDIT.RECORD_VERIFIED, targetType: 'experiment_record', targetId: row.id, metadata: { decision, student: studentId } });
  await notify({
    audience: { kind: 'users', userIds: [studentId] },
    category: 'EXPERIMENT_VERIFIED',
    title: decision === 'VERIFIED' ? 'Your record file was verified' : 'Your record file was rejected',
    body: note || 'Open the experiment for details.',
    entityType: 'experiment',
    entityId: experimentId,
  });
  return updated;
}

export async function getMyRecord(actor: AuthUser, experimentId: string) {
  const [row] = await orm
    .select()
    .from(experimentRecords)
    .where(and(eq(experimentRecords.experimentId, experimentId), eq(experimentRecords.userId, actor.id)))
    .limit(1);
  return row || null;
}

export async function getMyCompletion(actor: AuthUser, experimentId: string) {
  const [row] = await orm
    .select()
    .from(experimentCompletions)
    .where(and(eq(experimentCompletions.experimentId, experimentId), eq(experimentCompletions.userId, actor.id)))
    .limit(1);
  return row || null;
}

// ---------------------------------------------------------------- experiment resources

export async function listExpResources(viewer: AuthUser, experimentId: string) {
  const rows = await orm
    .select({
      id: experimentResources.id,
      kind: experimentResources.kind,
      title: experimentResources.title,
      url: experimentResources.url,
      fileId: experimentResources.fileId,
      status: experimentResources.status,
      uploaderId: experimentResources.uploaderId,
      note: experimentResources.note,
      createdAt: experimentResources.createdAt,
      uploaderName: users.name,
    })
    .from(experimentResources)
    .innerJoin(users, eq(experimentResources.uploaderId, users.id))
    .where(and(eq(experimentResources.experimentId, experimentId), isNull(experimentResources.deletedAt)))
    .orderBy(desc(experimentResources.createdAt));
  const staff = viewer.role !== ROLES.STUDENT;
  return rows.filter((r) => r.status === 'APPROVED' || r.uploaderId === viewer.id || (staff && r.status === 'PENDING'));
}

export async function addExpResource(actor: AuthUser, experimentId: string, input: { kind: 'FILE' | 'LINK'; title: string; url?: string; fileId?: string }) {
  const [exp] = await orm.select().from(experiments).where(and(eq(experiments.id, experimentId), isNull(experiments.deletedAt))).limit(1);
  if (!exp) throw ApiError.notFound('Experiment not found');
  if (input.kind === 'LINK') {
    if (!input.url || !/^https?:\/\//i.test(input.url)) throw ApiError.badRequest('Provide a valid http(s) link');
  } else if (!input.fileId) throw ApiError.badRequest('File is required');
  const autoApproved = can.verifyResource(actor);
  const [row] = await orm
    .insert(experimentResources)
    .values({
      experimentId,
      uploaderId: actor.id,
      kind: input.kind,
      title: input.title.trim(),
      url: input.kind === 'LINK' ? input.url : null,
      fileId: input.kind === 'FILE' ? input.fileId : null,
      status: autoApproved ? 'APPROVED' : 'PENDING',
      verifiedById: autoApproved ? actor.id : null,
      verifiedAt: autoApproved ? new Date() : null,
    })
    .returning();
  await audit({ actor, action: AUDIT.RESOURCE_SHARED, targetType: 'experiment_resource', targetId: row.id, metadata: { status: row.status } });
  return row;
}

export async function verifyExpResource(actor: AuthUser, resourceId: string, decision: 'APPROVED' | 'REJECTED', note?: string) {
  if (!can.verifyResource(actor)) throw ApiError.forbidden();
  const [row] = await orm.select().from(experimentResources).where(eq(experimentResources.id, resourceId)).limit(1);
  if (!row || row.deletedAt) throw ApiError.notFound('Resource not found');
  if (row.status !== 'PENDING') throw ApiError.conflict('Resource already verified');
  const [updated] = await orm
    .update(experimentResources)
    .set({ status: decision, verifiedById: actor.id, verifiedAt: new Date(), note })
    .where(eq(experimentResources.id, resourceId))
    .returning();
  await audit({ actor, action: AUDIT.RESOURCE_VERIFIED, targetType: 'experiment_resource', targetId: resourceId, metadata: { decision } });
  await notify({
    audience: { kind: 'users', userIds: [row.uploaderId] },
    category: decision === 'APPROVED' ? 'RESOURCE_APPROVED' : 'RESOURCE_REJECTED',
    title: decision === 'APPROVED' ? 'Your resource was approved' : 'Your resource was rejected',
    body: row.title,
    entityType: 'experiment_resource',
    entityId: resourceId,
  });
  return updated;
}
