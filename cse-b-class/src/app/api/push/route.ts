import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { subscribePush } from '@/server/notify';
import { orm } from '@/server/db';
import { pushSubscriptions } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** Public VAPID key for push subscription (§31). Empty when push is not configured. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(req);
    return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(
      req,
      z.object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      }),
    );
    await subscribePush(user.id, { endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth });
    return Response.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(req, z.object({ endpoint: z.string().url() }));
    await orm
      .update(pushSubscriptions)
      .set({ deletedAt: new Date() })
      .where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, input.endpoint)));
    return Response.json({ ok: true });
  });
}
