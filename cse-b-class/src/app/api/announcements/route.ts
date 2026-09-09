import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { createAnnouncement, listAnnouncements } from '@/server/services/announcements';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ announcements: await listAnnouncements(user) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(
      req,
      z.object({
        title: z.string().min(2).max(150),
        message: z.string().min(2).max(4000),
        link: z.string().url().optional(),
        fileId: z.string().optional(),
      }),
    );
    return Response.json({ announcement: await createAnnouncement(actor, input) });
  });
}
