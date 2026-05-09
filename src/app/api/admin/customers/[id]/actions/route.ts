import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin, requireRole, logAdminAction } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

const schema = z.object({
  action: z.enum(['disable', 'enable', 'promote_support', 'promote_admin', 'demote_customer']),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_action' }, { status: 400 });

  // Ações sensíveis exigem admin; disable/enable podem ser feitas por support
  const needsAdmin = parsed.data.action.startsWith('promote_') || parsed.data.action === 'demote_customer';
  const guard = needsAdmin ? requireAdmin : (r: Request) => requireRole(r, ['admin', 'support']);
  const { ctx, response } = await guard(req);
  if (!ctx) return response;

  const [target] = await db.select().from(users).where(eq(users.id, params.id)).limit(1);
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const updates: Partial<typeof users.$inferInsert> = {};
  switch (parsed.data.action) {
    case 'disable':
      updates.disabledAt = new Date();
      break;
    case 'enable':
      updates.disabledAt = null;
      break;
    case 'promote_support':
      updates.role = 'support';
      break;
    case 'promote_admin':
      updates.role = 'admin';
      break;
    case 'demote_customer':
      updates.role = 'customer';
      break;
  }

  await db.update(users).set(updates).where(eq(users.id, target.id));
  await logAdminAction({
    actorId: ctx.userId,
    targetUserId: target.id,
    action: parsed.data.action,
    payload: { before: { role: target.role, disabledAt: target.disabledAt } },
  });

  return NextResponse.json({ ok: true, action: parsed.data.action });
}
