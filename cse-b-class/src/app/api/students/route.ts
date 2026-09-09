import { handle } from '@/lib/api';
import { requireUser } from '@/server/auth';
import { listStudents } from '@/server/services/users';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req); // any signed-in member of the class
    const students = await listStudents(user); // field visibility applied per role (§9)
    return Response.json({ students });
  });
}
