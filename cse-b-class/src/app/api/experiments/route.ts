import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { createExperiment, listExperiments, listSubjectsWithExperiments } from '@/server/services/experiments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    const subjectId = new URL(req.url).searchParams.get('subjectId');
    if (subjectId) return Response.json({ experiments: await listExperiments(subjectId) });
    return Response.json({ subjects: await listSubjectsWithExperiments() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    const input = await body(
      req,
      z.object({
        subjectId: z.string(),
        number: z.number().int().min(1).max(100).optional(),
        name: z.string().min(2).max(150),
        details: z.string().max(5000).optional(),
        instructions: z.string().max(5000).optional(),
        requiredFilesNote: z.string().max(500).optional(),
      }),
    );
    return Response.json({ experiment: await createExperiment(actor, input) });
  });
}
