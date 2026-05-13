import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// Add new columns as the schema evolves — safe to run on every boot.
export async function runStartupMigrations() {
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS processing_error text`;
}
