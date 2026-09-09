import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { adminResetPassword } from '@/server/services/users';

export const dynamic = 'force-dynamic';

/** Secure account recovery (§8/§42): advisor/admin verifies identity out-of-band, then issues a one-time temp password. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'ADMIN']);
    return Response.json(await adminResetPassword(actor, params.id));
  });
}
