import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { createFolder, listFolders } from '@/server/services/assignments';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(req);
    return Response.json({ folders: await listFolders() });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const actor = await requireUser(req, ['ADVISOR', 'REPRESENTATIVE', 'ADMIN']);
    return Response.json({ folder: await createFolder(actor) });
  });
}
