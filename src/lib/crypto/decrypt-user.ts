import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './encrypt';

export type DecryptedUser = {
  id: string;
  fullName: string | null;
  email: string | null;
  cpf: string | null;
  pixKey: string | null;
  solanaWalletAddress: string | null;
};

export async function loadDecryptedUserByPrivyId(privyUserId: string): Promise<DecryptedUser | null> {
  const [row] = await db.select().from(users).where(eq(users.privyUserId, privyUserId)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    cpf: row.cpfEncrypted ? decrypt(row.cpfEncrypted) : null,
    pixKey: row.pixKeyEncrypted ? decrypt(row.pixKeyEncrypted) : null,
    solanaWalletAddress: row.solanaWalletAddress,
  };
}
