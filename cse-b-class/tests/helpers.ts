import { orm } from '@/server/db';
import { users } from '@/drizzle/schema';
import { hashPassword, type AuthUser } from '@/server/auth';
import { ROLES, type Role } from '@/lib/constants';

export async function seedUser(over: Partial<{ username: string; regNo: string; role: Role; name: string; password: string; dob: string; bloodGroup: string; address: string; mobile: string }> = {}) {
  const username = over.username ?? `T${Math.random().toString(36).slice(2, 10)}`;
  const [row] = await orm
    .insert(users)
    .values({
      username,
      regNo: over.regNo ?? username,
      role: over.role ?? ROLES.STUDENT,
      name: over.name ?? `Test ${username}`,
      passwordHash: hashPassword(over.password ?? 'password123'),
      dob: over.dob ?? '2005-01-01',
      bloodGroup: over.bloodGroup ?? 'O+',
      address: over.address ?? '1 Test Street',
      mobile: over.mobile ?? '9800000000',
    })
    .returning();
  const auth: AuthUser = {
    id: row.id,
    username: row.username,
    regNo: row.regNo,
    role: row.role as Role,
    name: row.name,
    mustChangePassword: false,
  };
  return { row, auth };
}

export async function seedSubject(code?: string) {
  const { createSubject } = await import('@/server/services/subjects');
  const { auth: admin } = await seedUser({ role: ROLES.ADMIN, username: code ? `admin-${code}` : undefined });
  const subject = await createSubject(admin, {
    name: `Subject ${code ?? Math.random().toString(36).slice(2, 6)}`,
    code: code ?? `T${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    facultyName: 'Test Faculty',
  });
  return { subject, admin };
}
