import { NextRequest } from 'next/server';
import { handle, body } from '@/lib/api';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { getStudent, updateProfile } from '@/server/services/users';

export const dynamic = 'force-dynamic';

const C = z.string().max(200).optional();

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    return Response.json({ student: await getStudent(user, params.id) });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser(req);
    const input = await body(
      req,
      z.object({
        name: C,
        mobile: C,
        address: z.string().max(500).optional(),
        bloodGroup: C,
        email: C,
        dob: C,
      }),
    );
    const result = await updateProfile(user, params.id, input);
    return Response.json(result);
  });
}
