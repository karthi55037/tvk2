import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { createItem, listItems } from '@/server/services/assignments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const folderId = new URL(req.url).searchParams.get('folderId');
    if (!folderId) return Response.json({ error: { code: 'BAD_REQUEST', message: 'folderId is required' } }, { status: 400 });
    return Response.json({ items: await listItems(folderId, user) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    const input = await body(
      req,
      z.object({
        folderId: z.string(),
        subjectId: z.string(),
        title: z.string().min(2).max(150),
        instructions: z.string().max(5000).optional(),
        deadline: z.string().optional(), // ISO datetime
        requiredFilesNote: z.string().max(500).optional(),
      }),
    );
    return Response.json({ item: await createItem(actor, input) });
  });
}
