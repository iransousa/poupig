import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { ensureSchedulerStarted } from '@/lib/scheduler/in-process';

ensureSchedulerStarted();

export async function GET(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      solanaWalletAddress: users.solanaWalletAddress,
      onboardedAt: users.onboardedAt,
    })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);

  if (!row) {
    return NextResponse.json({
      privyUserId: session.privyUserId,
      email: session.email,
      solanaWalletAddress: session.solanaWallet,
      onboarded: false,
    });
  }

  return NextResponse.json({
    ...row,
    onboarded: Boolean(row.onboardedAt),
  });
}
