import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getKaminoConfig } from '@/lib/kamino';

const DEFAULT_LAMPORTS = 1_000_000_000n; // 1 SOL

export async function POST(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const cfg = getKaminoConfig();
  if (cfg.cluster !== 'devnet') {
    return NextResponse.json(
      { error: 'only_devnet', message: 'Airdrop só disponível em devnet' },
      { status: 400 },
    );
  }

  const [user] = await db
    .select({ wallet: users.solanaWalletAddress })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);
  if (!user?.wallet) return NextResponse.json({ error: 'no_wallet' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { lamports?: string };
  const lamports = body.lamports ? BigInt(body.lamports) : DEFAULT_LAMPORTS;

  try {
    const { createSolanaRpc, address } = await import('@solana/kit');
    const rpc = createSolanaRpc(cfg.rpcUrl);
    const anyRpc = rpc as unknown as {
      requestAirdrop: (
        addr: unknown,
        lamports: bigint,
      ) => { send: () => Promise<string> };
    };
    const signature = await anyRpc.requestAirdrop(address(user.wallet), lamports).send();
    return NextResponse.json({
      ok: true,
      signature,
      lamports: lamports.toString(),
      wallet: user.wallet,
      explorer: `${cfg.explorerBase}/tx/${signature}?cluster=devnet`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    // Devnet rate-limits: "airdrop request failed" ou "429"
    const rateLimited = /rate|429|limit/i.test(msg);
    return NextResponse.json(
      {
        error: rateLimited ? 'rate_limited' : 'airdrop_failed',
        message: rateLimited
          ? 'Faucet devnet está limitado. Tente https://faucet.solana.com manualmente.'
          : msg,
      },
      { status: rateLimited ? 429 : 502 },
    );
  }
}
