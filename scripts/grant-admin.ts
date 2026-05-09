/**
 * Promove um user para admin.
 * Uso: pnpm admin:grant email@ex.com [admin|support]
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

async function main() {
  const email = process.argv[2];
  const role = (process.argv[3] ?? 'admin') as 'admin' | 'support';

  if (!email) {
    console.error('Uso: pnpm admin:grant <email> [admin|support]');
    process.exit(1);
  }

  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, role: users.role });

  if (!updated) {
    console.error(`Nenhum user encontrado com email ${email}`);
    process.exit(1);
  }

  console.log(`✓ ${updated.email} agora é ${updated.role}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
