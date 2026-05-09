import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role';
import { loadActiveAllocation, defaultFallbackTarget } from '@/lib/allocation/active';

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const active = await loadActiveAllocation();
  if (!active) {
    return NextResponse.json({
      strategyId: null,
      strategyName: 'Fallback (Main Market)',
      targets: [defaultFallbackTarget()],
      isDefault: true,
    });
  }
  return NextResponse.json({ ...active, isDefault: false });
}
