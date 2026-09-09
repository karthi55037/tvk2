import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { confirmODLetter } from '@/server/services/od';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const rep = await requireUser(req, ['REPRESENTATIVE']);
    return Response.json({ request: await confirmODLetter(rep, params.id) });
  });
}
