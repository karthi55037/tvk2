import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import * as schema from '@/drizzle/schema';

export function createDb(url?: string): Client {
  return createClient({ url: url || process.env.DATABASE_URL || 'file:./dev.db' });
}

export const db: Client = createDb();

export const orm = drizzle(db, { schema });
export { schema };
