import { NextResponse } from 'next/server';
import { verifyPrivyToken, getPrivyUser } from '@/lib/privy/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type Session = {
  privyUserId: string;
  email: string | null;
  phone: string | null;
  solanaWallet: string | null;
};

export async function getSession(req: Request): Promise<Session | null> {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  try {
    const claims = await verifyPrivyToken(token);
    const user = await getPrivyUser(claims.userId);
    return {
      privyUserId: user.id,
      email: user.email,
      phone: user.phone,
      solanaWallet: user.solanaWallet,
    };
  } catch {
    return null;
  }
}

export async function requireSession(req: Request) {
  const session = await getSession(req);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }
  return { session, response: null };
}

export async function getDbUserByPrivyId(privyUserId: string) {
  const [row] = await db.select().from(users).where(eq(users.privyUserId, privyUserId)).limit(1);
  return row ?? null;
}
