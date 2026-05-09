import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireSession, type Session } from './session';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export type Role = 'customer' | 'admin' | 'support';

export type AdminContext = {
  session: Session;
  userId: string;
  role: Role;
};

type RoleResult =
  | { ctx: AdminContext; response: null }
  | { ctx: null; response: Response };

export async function requireRole(
  req: Request,
  roles: Role[] = ['admin', 'support'],
): Promise<RoleResult> {
  const { session, response } = await requireSession(req);
  if (!session) return { ctx: null, response: response! };

  const [row] = await db
    .select({ id: users.id, role: users.role, disabledAt: users.disabledAt })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);

  if (!row || row.disabledAt) {
    return {
      ctx: null,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    };
  }

  if (!roles.includes(row.role as Role)) {
    return {
      ctx: null,
      response: NextResponse.json({ error: 'not_authorized' }, { status: 403 }),
    };
  }

  return {
    ctx: { session, userId: row.id, role: row.role as Role },
    response: null,
  };
}

export function requireAdmin(req: Request) {
  return requireRole(req, ['admin']);
}

export async function logAdminAction(opts: {
  actorId: string;
  action: string;
  targetUserId?: string | null;
  payload?: unknown;
}) {
  const { adminActions } = await import('@/lib/db/schema');
  await db.insert(adminActions).values({
    actorId: opts.actorId,
    targetUserId: opts.targetUserId ?? null,
    action: opts.action,
    payload: (opts.payload as object) ?? null,
  });
}
