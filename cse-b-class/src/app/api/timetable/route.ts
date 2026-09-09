import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { clearSlot, getTimetable, upsertSlot } from '@/server/services/timetable';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(req);
    return Response.json({ slots: await getTimetable() });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(
      req,
      z.object({
        dayOfWeek: z.number().int().min(1).max(6),
        period: z.number().int().min(1).max(8),
        subjectId: z.string().nullish(),
        isLab: z.boolean().optional(),
        labName: z.string().max(60).nullish(),
        labFloor: z.string().max(20).nullish(),
      }),
    );
    return Response.json(await upsertSlot(actor, input));
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req);
    const input = await body(req, z.object({ dayOfWeek: z.number().int().min(1).max(6), period: z.number().int().min(1).max(8) }));
    return Response.json(await clearSlot(actor, input.dayOfWeek, input.period));
  });
}
