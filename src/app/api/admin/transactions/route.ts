import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { transactions, users } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const kind = url.searchParams.get('kind');
  const q = url.searchParams.get('q')?.trim();
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
  const offset = Number(url.searchParams.get('offset') ?? '0');

  const conditions = [];
  if (
    status &&
    ['pending', 'processing', 'paid', 'error', 'expired'].includes(status)
  ) {
    conditions.push(eq(transactions.status, status as 'pending'));
  }
  if (kind === 'onramp' || kind === 'offramp') {
    conditions.push(eq(transactions.kind, kind));
  }
  if (q) {
    conditions.push(
      or(
        ilike(transactions.id, `%${q}%`),
        ilike(transactions.fourPTxid, `%${q}%`),
        ilike(users.email, `%${q}%`),
        ilike(users.fullName, `%${q}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      status: transactions.status,
      amountBrl: transactions.amountBrl,
      amountUsdc: transactions.amountUsdc,
      fourPTxid: transactions.fourPTxid,
      solanaSignature: transactions.solanaSignature,
      errorMessage: transactions.errorMessage,
      createdAt: transactions.createdAt,
      confirmedAt: transactions.confirmedAt,
      userId: users.id,
      userEmail: users.email,
      userFullName: users.fullName,
    })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.userId))
    .where(conditions.length ? and(...conditions) : undefined);

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      amountBrl: r.amountBrl ? Number(r.amountBrl) : null,
      amountUsdc: r.amountUsdc ? Number(r.amountUsdc) : null,
    })),
    total: countRow.total,
    limit,
    offset,
  });
}
