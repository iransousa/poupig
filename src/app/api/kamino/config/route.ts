import { NextResponse } from 'next/server';
import { getKaminoConfig } from '@/lib/kamino';

export async function GET() {
  const cfg = getKaminoConfig();
  return NextResponse.json({
    env: cfg.env,
    cluster: cfg.cluster,
    programId: cfg.programId,
    mainMarket: cfg.mainMarket,
    usdcMint: cfg.usdcMint,
    explorerBase: cfg.explorerBase,
  });
}
