import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { announcementReads, announcements, users } from '@/drizzle/schema';
import { ROLES, AUDIT } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { audit } from '@/server/audit';
import { notify } from '@/server/notify';
import { can } from '@/server/rbac';

export async function createAnnouncement(actor: AuthUser, input: { title: string; message: string; link?: string; fileId?: string }) {
  if (!can.createAnnouncement(actor)) throw ApiError.forbidden('Only the Advisor and Representatives can create announcements');
  if (!input.title.trim() || !input.message.trim()) throw ApiError.badRequest('Title and message are required');
  if (input.title.length > 150) throw ApiError.badRequest('Title is too long');
  const [row] = await orm
    .insert(announcements)
    .values({
      title: input.title.trim(),
      message: input.message.trim(),
      link: input.link || null,
      fileId: input.fileId || null,
      createdById: actor.id,
    })
    .returning();

  await audit({ actor, action: AUDIT.ANNOUNCEMENT_CREATED, targetType: 'announcement', targetId: row.id });
  const recipients = await orm.select({ id: users.id }).from(users).where(and(isNull(users.deletedAt), eq(users.isActive, true)));
  await notify({
    audience: { kind: 'users', userIds: recipients.map((r) => r.id) },
    category: 'ANNOUNCEMENT',
    title: `Announcement: ${row.title}`,
    body: row.message.slice(0, 140),
    entityType: 'announcement',
    entityId: row.id,
    excludeUserIds: [actor.id],
  });
  return row;
}

export async function listAnnouncements(viewer: AuthUser) {
  const rows = await orm.select().from(announcements).where(isNull(announcements.deletedAt)).orderBy(desc(announcements.createdAt)).limit(100);
  const reads = await orm.select().from(announcementReads).where(eq(announcementReads.userId, viewer.id));
  const readSet = new Set(reads.map((r) => r.announcementId));
  const creators = await orm.select({ id: users.id, name: users.name }).from(users);
  const creatorMap = new Map(creators.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    link: r.link,
    fileId: r.fileId,
    creatorName: creatorMap.get(r.createdById) || 'Staff',
    createdAt: r.createdAt,
    read: readSet.has(r.id),
  }));
}

export async function markRead(user: AuthUser, id: string) {
  await orm.insert(announcementReads).values({ announcementId: id, userId: user.id }).onConflictDoNothing();
  return { ok: true };
}

export async function deleteAnnouncement(actor: AuthUser, id: string) {
  const [row] = await orm.select().from(announcements).where(and(eq(announcements.id, id), isNull(announcements.deletedAt))).limit(1);
  if (!row) throw ApiError.notFound();
  const allowed = actor.role === ROLES.ADVISOR || actor.role === ROLES.ADMIN || row.createdById === actor.id;
  if (!allowed) throw ApiError.forbidden();
  await orm.update(announcements).set({ deletedAt: new Date(), deletedById: actor.id }).where(eq(announcements.id, id));
  await audit({ actor, action: AUDIT.ANNOUNCEMENT_DELETED, targetType: 'announcement', targetId: id });
  return { ok: true };
}

export async function unreadCount(user: AuthUser): Promise<number> {
  const rows = await orm.select({ id: announcements.id }).from(announcements).where(isNull(announcements.deletedAt)).orderBy(desc(announcements.createdAt)).limit(100);
  if (rows.length === 0) return 0;
  const reads = await orm
    .select()
    .from(announcementReads)
    .where(and(eq(announcementReads.userId, user.id), inArray(announcementReads.announcementId, rows.map((r) => r.id))));
  return rows.length - reads.length;
}
