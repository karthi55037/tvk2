import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { deleteAnnouncement } from '@/server/services/announcements';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireUser(req);
    return Response.json(await deleteAnnouncement(actor, params.id));
  });
}
