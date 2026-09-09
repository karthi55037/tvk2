import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { orm } from '@/server/db';
import {
  assignmentFolders,
  assignmentItems,
  assignmentResources,
  assignmentSubmissions,
  subjects,
  users,
} from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { can } from '@/server/rbac';
import { publishAll } from '@/server/realtime';

// ---------------------------------------------------------------- folders ("Assignment N")

export async function listFolders() {
  const folders = await orm.select().from(assignmentFolders).orderBy(asc(assignmentFolders.number));
  const items = await orm
    .select({ id: assignmentItems.id, folderId: assignmentItems.folderId, subjectName: subjects.name, deadline: assignmentItems.deadline })
    .from(assignmentItems)
    .innerJoin(subjects, eq(assignmentItems.subjectId, subjects.id))
    .where(isNull(assignmentItems.deletedAt));
  return folders.map((f) => ({
    ...f,
    itemCount: items.filter((i) => i.folderId === f.id).length,
    subjects: items.filter((i) => i.folderId === f.id).map((i) => ({ id: i.id, subjectName: i.subjectName, deadline: i.deadline })),
  }));
}

export async function createFolder(actor: AuthUser) {
  if (!can.manageAssignments(actor)) throw ApiError.forbidden();
  const [max] = await orm.select({ n: sql<number>`coalesce(max(${assignmentFolders.number}), 0)` }).from(assignmentFolders);
  const [row] = await orm.insert(assignmentFolders).values({ number: Number(max?.n ?? 0) + 1, createdById: actor.id }).returning();
  await audit({ actor, action: AUDIT.FOLDER_CREATED, targetType: 'assignment_folder', targetId: row.id, metadata: { number: row.number } });
  return row;
}

export async function setFolderStatus(actor: AuthUser, folderId: string, status: 'ACTIVE' | 'COMPLETED') {
  if (!can.manageAssignments(actor)) throw ApiError.forbidden();
  const [row] = await orm
    .update(assignmentFolders)
    .set({ status, completedAt: status === 'COMPLETED' ? new Date() : null, updatedAt: new Date() })
    .where(eq(assignmentFolders.id, folderId))
    .returning();
  if (!row) throw ApiError.notFound('Assignment folder not found');
  // Completed assignments are archived, never destroyed (§21/§24)
  await audit({ actor, action: AUDIT.FOLDER_STATUS, targetType: 'assignment_folder', targetId: folderId, metadata: { status } });
  publishAll({ type: 'refresh', topic: 'assignments' });
  return row;
}

// ---------------------------------------------------------------- items (subject assignments)

export async function listItems(folderId: string, viewer: AuthUser) {
  const items = await orm
    .select({
      id: assignmentItems.id,
      folderId: assignmentItems.folderId,
      folderNumber: assignmentFolders.number,
      folderStatus: assignmentFolders.status,
      subjectId: assignmentItems.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      title: assignmentItems.title,
      instructions: assignmentItems.instructions,
      deadline: assignmentItems.deadline,
      requiredFilesNote: assignmentItems.requiredFilesNote,
      createdAt: assignmentItems.createdAt,
    })
    .from(assignmentItems)
    .innerJoin(assignmentFolders, eq(assignmentItems.folderId, assignmentFolders.id))
    .innerJoin(subjects, eq(assignmentItems.subjectId, subjects.id))
    .where(and(eq(assignmentItems.folderId, folderId), isNull(assignmentItems.deletedAt)))
    .orderBy(asc(subjects.name));

  if (items.length === 0) return [];
  const ids = items.map((i) => i.id);
  const subs = await orm.select().from(assignmentSubmissions).where(inArray(assignmentSubmissions.itemId, ids));
  const resources = await orm
    .select({ id: assignmentResources.id, itemId: assignmentResources.itemId, status: assignmentResources.status })
    .from(assignmentResources)
    .where(and(inArray(assignmentResources.itemId, ids), isNull(assignmentResources.deletedAt)));
  const [studentCount] = await orm
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(and(inArray(users.role, [ROLES.STUDENT, ROLES.REPRESENTATIVE]), isNull(users.deletedAt), eq(users.isActive, true)));
  const total = Number(studentCount?.n ?? 0);

  return items.map((item) => {
    const mine = subs.find((s) => s.itemId === item.id && s.userId === viewer.id);
    const itemSubs = subs.filter((s) => s.itemId === item.id && s.status === 'SUBMITTED');
    return {
      ...item,
      myStatus: mine?.status ?? null,
      submitted: itemSubs.length,
      total,
      pendingResources: resources.filter((r) => r.itemId === item.id && r.status === 'PENDING').length,
    };
  });
}

export async function createItem(actor: AuthUser, input: {
  folderId: string;
  subjectId: string;
  title: string;
  instructions?: string;
  deadline?: string;
  requiredFilesNote?: string;
}) {
  if (!can.manageAssignments(actor)) throw ApiError.forbidden();
  const [folder] = await orm.select().from(assignmentFolders).where(eq(assignmentFolders.id, input.folderId)).limit(1);
  if (!folder) throw ApiError.notFound('Assignment folder not found');
  const [subject] = await orm.select().from(subjects).where(and(eq(subjects.id, input.subjectId), isNull(subjects.deletedAt))).limit(1);
  if (!subject) throw ApiError.badRequest('Unknown subject');
  const [dup] = await orm
    .select()
    .from(assignmentItems)
    .where(and(eq(assignmentItems.folderId, input.folderId), eq(assignmentItems.subjectId, input.subjectId), isNull(assignmentItems.deletedAt)))
    .limit(1);
  if (dup) throw ApiError.conflict(`${subject.name} already has an assignment in Assignment ${folder.number}`);

  const [row] = await orm
    .insert(assignmentItems)
    .values({
      folderId: input.folderId,
      subjectId: input.subjectId,
      title: input.title.trim(),
      instructions: input.instructions,
      deadline: input.deadline ? new Date(input.deadline) : null,
      requiredFilesNote: input.requiredFilesNote,
      createdById: actor.id,
    })
    .returning();

  await audit({ actor, action: AUDIT.ITEM_CREATED, targetType: 'assignment_item', targetId: row.id, metadata: { folder: folder.number, subject: subject.code } });
  const students = await orm
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, [ROLES.STUDENT, ROLES.REPRESENTATIVE]), isNull(users.deletedAt), eq(users.isActive, true)));
  await notify({
    audience: { kind: 'users', userIds: students.map((s) => s.id) },
    category: 'ASSIGNMENT_NEW',
    title: `New assignment: ${row.title}`,
    body: `${subject.name} — Assignment ${folder.number}`,
    entityType: 'assignment_item',
    entityId: row.id,
    excludeUserIds: [actor.id],
  });
  publishAll({ type: 'refresh', topic: 'assignments' });
  return row;
}

export async function getItem(actor: AuthUser, itemId: string) {
  const [row] = await orm
    .select({
      id: assignmentItems.id,
      folderId: assignmentItems.folderId,
      folderNumber: assignmentFolders.number,
      folderStatus: assignmentFolders.status,
      subjectId: assignmentItems.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      facultyName: subjects.facultyName,
      title: assignmentItems.title,
      instructions: assignmentItems.instructions,
      deadline: assignmentItems.deadline,
      requiredFilesNote: assignmentItems.requiredFilesNote,
      createdAt: assignmentItems.createdAt,
    })
    .from(assignmentItems)
    .innerJoin(assignmentFolders, eq(assignmentItems.folderId, assignmentFolders.id))
    .innerJoin(subjects, eq(assignmentItems.subjectId, subjects.id))
    .where(and(eq(assignmentItems.id, itemId), isNull(assignmentItems.deletedAt)))
    .limit(1);
  if (!row) throw ApiError.notFound('Assignment not found');
  return row;
}

export async function updateItem(actor: AuthUser, itemId: string, patch: Partial<{
  title: string;
  instructions: string;
  deadline: string | null;
  requiredFilesNote: string | null;
}>) {
  if (!can.manageAssignments(actor)) throw ApiError.forbidden();
  const [row] = await orm.select().from(assignmentItems).where(and(eq(assignmentItems.id, itemId), isNull(assignmentItems.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('Assignment not found');
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) updates.title = patch.title.trim();
  if (patch.instructions !== undefined) updates.instructions = patch.instructions;
  if (patch.requiredFilesNote !== undefined) updates.requiredFilesNote = patch.requiredFilesNote;
  if (patch.deadline !== undefined) updates.deadline = patch.deadline ? new Date(patch.deadline) : null;
  await orm.update(assignmentItems).set(updates).where(eq(assignmentItems.id, itemId));
  await audit({ actor, action: AUDIT.ITEM_UPDATED, targetType: 'assignment_item', targetId: itemId, metadata: { fields: Object.keys(patch) } });
  publishAll({ type: 'refresh', topic: 'assignments' });
  return { id: itemId };
}

/** Archive/restore an individual item (retained, never destroyed). */
export async function deleteItem(actor: AuthUser, itemId: string) {
  if (!can.manageAssignments(actor)) throw ApiError.forbidden();
  const [row] = await orm.update(assignmentItems).set({ deletedAt: new Date() }).where(and(eq(assignmentItems.id, itemId), isNull(assignmentItems.deletedAt))).returning();
  if (!row) throw ApiError.notFound('Assignment not found');
  await audit({ actor, action: AUDIT.ITEM_DELETED, targetType: 'assignment_item', targetId: itemId });
  publishAll({ type: 'refresh', topic: 'assignments' });
  return { ok: true };
}

// ---------------------------------------------------------------- submissions (§21)

export async function getSubmissions(viewer: AuthUser, itemId: string) {
  const item = await getItem(viewer, itemId);
  const students = await orm
    .select({ id: users.id, name: users.name, regNo: users.regNo })
    .from(users)
    .where(and(inArray(users.role, [ROLES.STUDENT, ROLES.REPRESENTATIVE]), isNull(users.deletedAt), eq(users.isActive, true)))
    .orderBy(asc(users.regNo));
  const subs = await orm.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.itemId, itemId));
  const list = students.map((s) => {
    const sub = subs.find((x) => x.userId === s.id);
    return { userId: s.id, name: s.name, regNo: s.regNo, status: sub?.status ?? null, markedAt: sub?.markedAt ?? null };
  });
  const submitted = list.filter((l) => l.status === 'SUBMITTED').length;
  return {
    item: { id: item.id, title: item.title, subjectName: item.subjectName },
    submissions: list,
    stats: { submitted, total: list.length, pending: list.length - submitted },
  };
}

/** Students mark only themselves; Reps/Advisor/Admin can set any student's status (§21). */
export async function setSubmission(actor: AuthUser, itemId: string, targetUserId: string, status: 'SUBMITTED' | 'NOT_SUBMITTED') {
  const [item] = await orm.select().from(assignmentItems).where(and(eq(assignmentItems.id, itemId), isNull(assignmentItems.deletedAt))).limit(1);
  if (!item) throw ApiError.notFound('Assignment not found');
  const self = actor.id === targetUserId;
  if (!self && !can.setAnySubmission(actor)) {
    throw ApiError.forbidden('Only representatives/advisor can change another student\'s submission status');
  }
  if (self && actor.role !== ROLES.STUDENT && actor.role !== ROLES.REPRESENTATIVE) {
    throw ApiError.forbidden('Only students mark their own submissions');
  }
  const [target] = await orm.select().from(users).where(and(eq(users.id, targetUserId), isNull(users.deletedAt))).limit(1);
  if (!target || ![ROLES.STUDENT, ROLES.REPRESENTATIVE].includes(target.role as never)) throw ApiError.badRequest('Target is not a student');

  const values = { itemId, userId: targetUserId, status, markedById: actor.id, updatedAt: new Date() };
  const [row] = await orm
    .insert(assignmentSubmissions)
    .values(values)
    .onConflictDoUpdate({ target: [assignmentSubmissions.itemId, assignmentSubmissions.userId], set: values })
    .returning();

  await audit({
    actor,
    action: AUDIT.SUBMISSION_SET,
    targetType: 'assignment_item',
    targetId: itemId,
    metadata: { student: targetUserId, status, bySelf: self },
  });
  if (!self) {
    await notify({
      audience: { kind: 'users', userIds: [targetUserId] },
      category: 'SUBMISSION_MARKED',
      title: `Submission marked ${status === 'SUBMITTED' ? 'Submitted' : 'Not Submitted'}`,
      body: `${item.title}`,
      entityType: 'assignment_item',
      entityId: itemId,
    });
  }
  publishAll({ type: 'refresh', topic: `assignment:${itemId}` });
  return row;
}

// ---------------------------------------------------------------- resources (§22)

export async function listResources(viewer: AuthUser, itemId: string) {
  const rows = await orm
    .select({
      id: assignmentResources.id,
      kind: assignmentResources.kind,
      title: assignmentResources.title,
      url: assignmentResources.url,
      fileId: assignmentResources.fileId,
      status: assignmentResources.status,
      uploaderId: assignmentResources.uploaderId,
      note: assignmentResources.note,
      createdAt: assignmentResources.createdAt,
      uploaderName: users.name,
      uploaderRole: users.role,
    })
    .from(assignmentResources)
    .innerJoin(users, eq(assignmentResources.uploaderId, users.id))
    .where(and(eq(assignmentResources.itemId, itemId), isNull(assignmentResources.deletedAt)))
    .orderBy(desc(assignmentResources.createdAt));
  const staff = viewer.role !== ROLES.STUDENT;
  return rows.filter((r) => {
    if (r.status === 'APPROVED') return true;
    if (r.uploaderId === viewer.id) return true; // own pending shares visible to them
    return staff && r.status === 'PENDING'; // verification queue
  });
}

export async function addResource(actor: AuthUser, itemId: string, input: { kind: 'FILE' | 'LINK'; title: string; url?: string; fileId?: string }) {
  const [item] = await orm.select().from(assignmentItems).where(and(eq(assignmentItems.id, itemId), isNull(assignmentItems.deletedAt))).limit(1);
  if (!item) throw ApiError.notFound('Assignment not found');
  if (input.kind === 'LINK') {
    if (!input.url || !/^https?:\/\//i.test(input.url)) throw ApiError.badRequest('Provide a valid http(s) link');
  } else if (!input.fileId) throw ApiError.badRequest('File is required');
  // Student shares start PENDING and become official only after verification (§22)
  const autoApproved = can.verifyResource(actor);
  const [row] = await orm
    .insert(assignmentResources)
    .values({
      itemId,
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
  await audit({ actor, action: AUDIT.RESOURCE_SHARED, targetType: 'assignment_resource', targetId: row.id, metadata: { status: row.status } });
  if (!autoApproved) {
    await notify({
      audience: { kind: 'roles', roles: [ROLES.REPRESENTATIVE] },
      category: 'RESOURCE_APPROVED', // reuse approval-preference category for queue pings
      title: 'Resource awaiting verification',
      body: `${actor.name} shared "${row.title}" — review needed`,
      entityType: 'assignment_resource',
      entityId: row.id,
      excludeUserIds: [actor.id],
    });
  } else {
    publishAll({ type: 'refresh', topic: `assignment:${itemId}` });
  }
  return row;
}

export async function verifyResource(actor: AuthUser, resourceId: string, decision: 'APPROVED' | 'REJECTED', note?: string) {
  if (!can.verifyResource(actor)) throw ApiError.forbidden('Only representatives/advisor/admin verify resources');
  const [row] = await orm.select().from(assignmentResources).where(and(eq(assignmentResources.id, resourceId), isNull(assignmentResources.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound('Resource not found');
  if (row.status !== 'PENDING') throw ApiError.conflict('Resource already verified');
  const [updated] = await orm
    .update(assignmentResources)
    .set({ status: decision, verifiedById: actor.id, verifiedAt: new Date(), note })
    .where(eq(assignmentResources.id, resourceId))
    .returning();
  await audit({ actor, action: AUDIT.RESOURCE_VERIFIED, targetType: 'assignment_resource', targetId: resourceId, metadata: { decision } });
  await notify({
    audience: { kind: 'users', userIds: [row.uploaderId] },
    category: decision === 'APPROVED' ? 'RESOURCE_APPROVED' : 'RESOURCE_REJECTED',
    title: decision === 'APPROVED' ? 'Your shared resource was approved' : 'Your shared resource was rejected',
    body: row.title,
    entityType: 'assignment_resource',
    entityId: resourceId,
  });
  publishAll({ type: 'refresh', topic: `assignment:${row.itemId}` });
  return updated;
}

export async function removeResource(actor: AuthUser, resourceId: string) {
  const [row] = await orm.select().from(assignmentResources).where(eq(assignmentResources.id, resourceId)).limit(1);
  if (!row) throw ApiError.notFound();
  const allowed = row.uploaderId === actor.id || can.verifyResource(actor);
  if (!allowed) throw ApiError.forbidden();
  await orm.update(assignmentResources).set({ deletedAt: new Date() }).where(eq(assignmentResources.id, resourceId));
  await audit({ actor, action: AUDIT.RESOURCE_REMOVED, targetType: 'assignment_resource', targetId: resourceId });
  return { ok: true };
}

/** Pending verification queues for the rep console. */
export async function pendingResourceCount() {
  const [row] = await orm
    .select({ n: sql<number>`count(*)` })
    .from(assignmentResources)
    .where(and(eq(assignmentResources.status, 'PENDING'), isNull(assignmentResources.deletedAt)));
  return Number(row?.n ?? 0);
}
