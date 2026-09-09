import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, orm } from '@/server/db';
import { notificationPreferences, notifications, pushSubscriptions, users } from '@/drizzle/schema';
import { NOTIFICATION_CATEGORIES, type NotificationCategory, type Role } from '@/lib/constants';
import { publishToUser } from '@/server/realtime';
import { AUDIT, audit } from '@/server/audit';

type Audience =
  | { kind: 'users'; userIds: string[] }
  | { kind: 'roles'; roles: Role[] };

let webpush: typeof import('web-push') | null = null;
async function getWebPush() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return null;
  if (!webpush) {
    const mod = await import('web-push');
    mod.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.edu', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    webpush = mod;
  }
  return webpush;
}

export async function getPreferences(userId: string): Promise<Record<string, boolean>> {
  const [row] = await orm.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  if (!row) return {};
  try {
    return JSON.parse(row.prefs);
  } catch {
    return {};
  }
}

export async function setPreferences(userId: string, prefs: Record<string, boolean>) {
  const clean: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(prefs)) {
    if ((NOTIFICATION_CATEGORIES as readonly string[]).includes(k)) clean[k] = Boolean(v);
  }
  await orm
    .insert(notificationPreferences)
    .values({ userId, prefs: JSON.stringify(clean) })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { prefs: JSON.stringify(clean) } });
  return clean;
}

async function resolveAudience(aud: Audience): Promise<string[]> {
  if (aud.kind === 'users') return aud.userIds;
  const rows = await orm
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, aud.roles), isNull(users.deletedAt), eq(users.isActive, true)));
  return rows.map((r) => r.id);
}

/**
 * Create in-app notification(s) + real-time ping + best-effort Web Push.
 * Per-user notification preferences are respected (§31) — turning a category
 * OFF stops delivery but never deletes or hides underlying data.
 */
export async function notify(input: {
  audience: Audience;
  category: NotificationCategory;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  excludeUserIds?: string[];
}) {
  const all = await resolveAudience(input.audience);
  const exclude = new Set(input.excludeUserIds || []);
  const targets: string[] = [];
  const prefRows = all.length
    ? await orm.select().from(notificationPreferences).where(inArray(notificationPreferences.userId, all))
    : [];
  const prefMap = new Map(prefRows.map((r) => [r.userId, r.prefs]));

  for (const userId of all) {
    if (exclude.has(userId)) continue;
    const raw = prefMap.get(userId);
    if (raw) {
      try {
        const prefs = JSON.parse(raw);
        if (prefs[input.category] === false) continue; // user turned this category off
      } catch { /* default on */ }
    }
    targets.push(userId);
  }
  if (targets.length === 0) return;

  await orm.insert(notifications).values(
    targets.map((userId) => ({
      userId,
      category: input.category,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    })),
  );

  for (const userId of targets) {
    publishToUser(userId, { type: 'notification', payload: { category: input.category, title: input.title, body: input.body, entityType: input.entityType, entityId: input.entityId } });
  }

  // Web Push — best effort, never blocks the request path
  try {
    const wp = await getWebPush();
    if (wp) {
      const subs = await orm
        .select()
        .from(pushSubscriptions)
        .where(and(inArray(pushSubscriptions.userId, targets), isNull(pushSubscriptions.deletedAt)));
      const payload = JSON.stringify({ title: input.title, body: input.body, category: input.category, entityType: input.entityType, entityId: input.entityId });
      await Promise.allSettled(
        subs.map((s) =>
          wp!
            .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
            .catch((err: { statusCode?: number }) => {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                // subscription gone — soft delete
                orm.update(pushSubscriptions).set({ deletedAt: new Date() }).where(eq(pushSubscriptions.endpoint, s.endpoint)).catch(() => {});
              }
            }),
        ),
      );
    }
  } catch (err) {
    console.error('[notify] web push failed (non-fatal)', err);
  }
}

export async function listNotifications(userId: string, limit = 50) {
  return orm.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(notifications.createdAt).limit(limit);
}

export async function markAllRead(userId: string) {
  await orm.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function subscribePush(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
  await orm
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.p256dh, auth: sub.auth, deletedAt: null },
    });
  await audit({ action: AUDIT.PUSH_SUBSCRIBED, targetType: 'push', targetId: sub.endpoint });
}

export { AUDIT };
