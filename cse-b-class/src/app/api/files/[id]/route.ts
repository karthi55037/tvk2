import { NextRequest } from 'next/server';
import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { authorizeFile, fileResponse } from '@/server/files';

export const dynamic = 'force-dynamic';

/** Authorized file access — every download passes the server-side permission check (§39). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    const { row, buffer } = await authorizeFile(user, params.id);
    const download = new URL(req.url).searchParams.get('download') === '1';
    return fileResponse(row, buffer, download);
  });
}
