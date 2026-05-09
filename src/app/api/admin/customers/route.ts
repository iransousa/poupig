import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, isNotNull, or, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { users, kaminoPositions } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const status = url.searchParams.get('status'); // 'active' | 'onboarded' | 'disabled'
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
  const offset = Number(url.searchParams.get('offset') ?? '0');

  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(users.email, `%${q}%`),
        ilike(users.fullName, `%${q}%`),
        ilike(users.solanaWalletAddress, `%${q}%`),
      )!,
    );
  }
  if (status === 'onboarded') conditions.push(isNotNull(users.onboardedAt));
  if (status === 'disabled') conditions.push(isNotNull(users.disabledAt));

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      solanaWallet: users.solanaWalletAddress,
      onboardedAt: users.onboardedAt,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
      usdcSupplied: kaminoPositions.usdcSupplied,
      usdcCurrentValue: kaminoPositions.usdcCurrentValue,
    })
    .from(users)
    .leftJoin(kaminoPositions, eq(kaminoPositions.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(conditions.length ? and(...conditions) : undefined);

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      usdcSupplied: r.usdcSupplied ? Number(r.usdcSupplied) : 0,
      usdcCurrentValue: r.usdcCurrentValue ? Number(r.usdcCurrentValue) : 0,
    })),
    total: countRow.total,
    limit,
    offset,
  });
}
