import { db, orm } from '@/server/db';
import { auditLogs } from '@/drizzle/schema';
import { AUDIT } from '@/lib/constants';
import type { AuthUser } from '@/server/auth';

export async function audit(input: {
  actor?: AuthUser | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await orm.insert(auditLogs).values({
      actorId: input.actor?.id ?? null,
      actorRole: input.actor?.role ?? null,
      actorName: input.actor?.name ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      ip: input.ip ?? null,
    });
  } catch (err) {
    console.error('[audit] failed to write audit log', err);
  }
}

export { AUDIT };
