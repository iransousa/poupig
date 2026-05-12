import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getKaminoConfig } from '@/lib/kamino';
import { env } from '@/env';

/**
 * Retorna saldo on-chain da wallet do user:
 *   - SOL (lamports → SOL)
 *   - USDC (token account → USDC)
 *
 * Em modo mock, retorna zeros (a wallet existe mas raramente tem saldo real).
 */
export async function GET(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const [user] = await db
    .select({ id: users.id, wallet: users.solanaWalletAddress })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);
  if (!user?.wallet) return NextResponse.json({ error: 'no_wallet' }, { status: 400 });

  const cfg = getKaminoConfig();

  // RPC: usa o que tem em SOLANA_RPC_URL ou fallback público
  const rpcUrl =
    env.SOLANA_RPC_URL ||
    (cfg.cluster === 'devnet'
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com');

  try {
    const { kit } = await import('@/lib/kamino/internal-kit').then((m) => m.loadKit());
    const rpc = kit.createSolanaRpc(rpcUrl);
    const owner = kit.address(user.wallet);

    const anyRpc = rpc as unknown as {
      getBalance: (a: unknown) => { send: () => Promise<{ value: bigint }> };
      getTokenAccountsByOwner: (
        owner: unknown,
        filter: unknown,
        opts: { encoding: string },
      ) => {
        send: () => Promise<{
          value: Array<{
            account: { data: { parsed: { info: { tokenAmount: { amount: string; decimals: number } } } } };
          }>;
        }>;
      };
    };

    const [solRes, tokenRes] = await Promise.all([
      anyRpc.getBalance(owner).send(),
      anyRpc
        .getTokenAccountsByOwner(
          owner,
          { mint: kit.address(cfg.usdcMint) },
          { encoding: 'jsonParsed' },
        )
        .send(),
    ]);

    const solLamports = Number(solRes.value);
    const sol = solLamports / 1e9;

    const usdc = tokenRes.value.reduce((sum, acc) => {
      const t = acc.account.data.parsed.info.tokenAmount;
      return sum + Number(t.amount) / 10 ** t.decimals;
    }, 0);

    return NextResponse.json({
      wallet: user.wallet,
      sol: Number(sol.toFixed(9)),
      solLamports,
      usdc: Number(usdc.toFixed(6)),
      cluster: cfg.cluster,
      env: cfg.env,
    });
  } catch (err) {
    return NextResponse.json(
      {
        wallet: user.wallet,
        sol: 0,
        usdc: 0,
        cluster: cfg.cluster,
        env: cfg.env,
        error: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    );
  }
}
