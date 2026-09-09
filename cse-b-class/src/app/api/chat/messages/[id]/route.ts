import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { emergencyTakedown, moderateThreadMessage } from '@/server/services/chat';

export const dynamic = 'force-dynamic';

/**
 * Moderation endpoints:
 * - POST { action: 'EMERGENCY_TAKEDOWN' } — App Administrator emergency mechanism for class chat (§19)
 * - POST { action: 'MODERATE' } — Advisor/Admin moderation inside assignment/experiment chats
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const input = await body(req, z.object({ action: z.enum(['EMERGENCY_TAKEDOWN', 'MODERATE']), note: z.string().max(300).optional() }));
    if (input.action === 'EMERGENCY_TAKEDOWN') {
      const admin = await requireUser(req, ['ADMIN']);
      return Response.json(await emergencyTakedown(admin, params.id, input.note || ''));
    }
    const actor = await requireUser(req, ['ADVISOR', 'ADMIN']);
    return Response.json(await moderateThreadMessage(actor, params.id, input.note || ''));
  });
}
