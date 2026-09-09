import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { removeAdmin } from '@/server/services/roles';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADMIN']);
    return Response.json(await removeAdmin(actor, params.id));
  });
}
