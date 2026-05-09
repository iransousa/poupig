import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role';
import { env } from '@/env';
import { getKaminoConfig } from '@/lib/kamino';

/**
 * Debug runtime — admin only. Mostra o estado dos drivers atualmente carregados,
 * sem expor secrets.
 */
export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin']);
  if (!ctx) return response;

  const kCfg = getKaminoConfig();

  return NextResponse.json({
    fourP: {
      driver: env.FOUR_P_DRIVER,
      apiKeyConfigured: Boolean(env.FOUR_P_API_KEY),
      apiKeyHint: env.FOUR_P_API_KEY
        ? `${env.FOUR_P_API_KEY.slice(0, 4)}...${env.FOUR_P_API_KEY.slice(-4)}`
        : null,
      apiBase: env.FOUR_P_API_BASE,
      webhookIpAllowlist: env.FOUR_P_WEBHOOK_IP_ALLOWLIST,
    },
    kamino: {
      env: kCfg.env,
      cluster: kCfg.cluster,
      programId: kCfg.programId,
      mainMarket: kCfg.mainMarket,
      usdcMint: kCfg.usdcMint,
      rpcUrl: kCfg.rpcUrl.replace(/api-key=[^&]+/, 'api-key=***'),
    },
    app: {
      url: env.NEXT_PUBLIC_APP_URL,
      cronEnabled: env.ENABLE_IN_PROCESS_CRON === 'true',
      cronSecretConfigured: Boolean(env.CRON_SECRET),
    },
    publicEnv: {
      fourPDriver: env.NEXT_PUBLIC_FOUR_P_DRIVER,
      kaminoEnv: env.NEXT_PUBLIC_KAMINO_ENV,
    },
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
