import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { previewImport } from '@/server/services/import';

export const dynamic = 'force-dynamic';

/** Step 1 of §41: upload → validate columns → validate rows → show preview + errors. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'ADMIN']);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Attach the Excel (.xlsx) file' } }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return Response.json(await previewImport(actor, buffer));
  });
}
