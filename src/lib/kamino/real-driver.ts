import type { DepositOpts, KaminoDriver, KaminoPosition, PreparedTx } from './types';
import { getKaminoConfig } from './config';

/**
 * Real driver para Kamino Lend (staging | mainnet) via klend-sdk v7 + @solana/kit.
 *
 * Features:
 *   - Multi-reserve: deposit/withdraw respeita opts.targetMint (ex: USDC, USDT, PYUSD)
 *   - Lookup tables: compress com compressTransactionMessageUsingAddressLookupTables
 *   - Preflight: checa saldo SOL (gas) + saldo do token específico do target
 *   - Mensagens PT-BR por tipo de falha
 */

async function loadKit() {
  const kit = await import('@solana/kit');
  const klend = await import('@kamino-finance/klend-sdk');
  return { kit, klend };
}

// Cache em memória pra evitar carregar todo o KaminoMarket a cada chamada.
// Carregar market faz ~30 RPC calls (uma por reserve) — caro e estoura rate limit
// do RPC público. Cache de 30s é suficiente; reserves mudam devagar.
type MarketCacheEntry = {
  market: Awaited<ReturnType<typeof loadMarketUncached>>['market'];
  rpc: unknown;
  loadedAt: number;
};

type CacheGlobal = {
  marketCache: MarketCacheEntry | null;
  inflight: Promise<MarketCacheEntry> | null;
};

const cacheGlobal = globalThis as unknown as { __poupappKaminoCache?: CacheGlobal };
if (!cacheGlobal.__poupappKaminoCache) {
  cacheGlobal.__poupappKaminoCache = { marketCache: null, inflight: null };
}

const MARKET_TTL_MS = 30_000;

async function loadMarketUncached() {
  const cfg = getKaminoConfig();
  const { kit, klend } = await loadKit();
  const rpc = kit.createSolanaRpc(cfg.rpcUrl);
  const marketAddr = kit.address(cfg.mainMarket);
  const programAddr = kit.address(cfg.programId);
  const market = await klend.KaminoMarket.load(rpc, marketAddr, 450, programAddr);
  if (!market) throw new Error(`Kamino market ${cfg.mainMarket} not found on ${cfg.env}`);
  return { market, rpc, cfg, kit, klend };
}

async function loadMarket() {
  const cache = cacheGlobal.__poupappKaminoCache!;
  const now = Date.now();

  if (cache.marketCache && now - cache.marketCache.loadedAt < MARKET_TTL_MS) {
    const { kit, klend } = await loadKit();
    return {
      market: cache.marketCache.market,
      rpc: cache.marketCache.rpc,
      cfg: getKaminoConfig(),
      kit,
      klend,
    };
  }

  // dedupe concurrent requests — se já tem uma em andamento, espera ela
  if (cache.inflight) {
    const entry = await cache.inflight;
    const { kit, klend } = await loadKit();
    return { market: entry.market, rpc: entry.rpc, cfg: getKaminoConfig(), kit, klend };
  }

  cache.inflight = (async () => {
    const fresh = await loadMarketUncached();
    const entry: MarketCacheEntry = {
      market: fresh.market,
      rpc: fresh.rpc,
      loadedAt: Date.now(),
    };
    cache.marketCache = entry;
    return entry;
  })();

  try {
    const entry = await cache.inflight;
    const { kit, klend } = await loadKit();
    return { market: entry.market, rpc: entry.rpc, cfg: getKaminoConfig(), kit, klend };
  } finally {
    cache.inflight = null;
  }
}

/**
 * Resolve o reserve baseado no mint (prioridade) ou símbolo.
 * Fallback: USDC reserve principal.
 */
async function resolveReserve(opts?: { targetMint?: string; symbol?: string }) {
  const { market, rpc, cfg, kit, klend } = await loadMarket();
  let reserve;
  if (opts?.targetMint) {
    reserve = market.getReserveByMint(kit.address(opts.targetMint));
  }
  if (!reserve && opts?.symbol) {
    reserve = market.getReserveBySymbol(opts.symbol);
  }
  if (!reserve) {
    reserve =
      market.getReserveBySymbol('USDC') ?? market.getReserveByMint(kit.address(cfg.usdcMint));
  }
  if (!reserve) {
    throw new Error(
      `Reserve não encontrado no market ${cfg.mainMarket} (mint=${opts?.targetMint ?? 'USDC'})`,
    );
  }
  return { market, reserve, rpc, cfg, kit, klend };
}

async function getCurrentSlot(rpc: unknown): Promise<bigint> {
  return (rpc as { getSlot: () => { send: () => Promise<bigint> } }).getSlot().send();
}

type KitModule = Awaited<ReturnType<typeof loadKit>>['kit'];

async function buildTxBase64(opts: {
  kit: KitModule;
  rpc: unknown;
  feePayer: string;
  instructions: unknown[];
  lookupTableAddresses?: unknown[];
}): Promise<string> {
  const { kit, rpc, feePayer, instructions, lookupTableAddresses = [] } = opts;
  const anyKit = kit as unknown as {
    address: (a: string) => unknown;
    createNoopSigner: (a: unknown) => unknown;
    pipe: (...fns: unknown[]) => unknown;
    createTransactionMessage: (cfg: { version: 0 }) => unknown;
    setTransactionMessageFeePayerSigner: (s: unknown, m: unknown) => unknown;
    setTransactionMessageLifetimeUsingBlockhash: (b: unknown, m: unknown) => unknown;
    appendTransactionMessageInstructions: (ixs: unknown[], m: unknown) => unknown;
    compressTransactionMessageUsingAddressLookupTables?: (m: unknown, alts: unknown) => unknown;
    fetchAddressesForLookupTables?: (addrs: unknown[], rpc: unknown) => Promise<unknown>;
    compileTransaction: (m: unknown) => unknown;
    getBase64EncodedWireTransaction: (t: unknown) => string;
  };

  const r = rpc as {
    getLatestBlockhash: (o?: { commitment?: string }) => {
      send: () => Promise<{ value: { blockhash: string; lastValidBlockHeight: bigint } }>;
    };
  };

  const signer = anyKit.createNoopSigner(anyKit.address(feePayer));
  const { value: blockhash } = await r.getLatestBlockhash({ commitment: 'confirmed' }).send();

  let message = anyKit.pipe(
    anyKit.createTransactionMessage({ version: 0 }),
    (m: unknown) => anyKit.setTransactionMessageFeePayerSigner(signer, m),
    (m: unknown) => anyKit.setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m: unknown) => anyKit.appendTransactionMessageInstructions(instructions, m),
  );

  if (
    lookupTableAddresses.length > 0 &&
    anyKit.fetchAddressesForLookupTables &&
    anyKit.compressTransactionMessageUsingAddressLookupTables
  ) {
    try {
      const lutAddrs = lookupTableAddresses.map((a) =>
        typeof a === 'string' ? anyKit.address(a) : a,
      );
      const addressesByLut = await anyKit.fetchAddressesForLookupTables(lutAddrs, rpc);
      message = anyKit.compressTransactionMessageUsingAddressLookupTables(message, addressesByLut);
    } catch (err) {
      console.warn('[kamino real] lookup table compression skipped:', err);
    }
  }

  const compiled = anyKit.compileTransaction(message);
  return anyKit.getBase64EncodedWireTransaction(compiled);
}

function collectIxs(action: {
  computeBudgetIxs?: unknown[];
  setupIxs?: unknown[];
  inBetweenIxs?: unknown[];
  lendingIxs?: unknown[];
  cleanupIxs?: unknown[];
}): unknown[] {
  return [
    ...(action.computeBudgetIxs ?? []),
    ...(action.setupIxs ?? []),
    ...(action.inBetweenIxs ?? []),
    ...(action.lendingIxs ?? []),
    ...(action.cleanupIxs ?? []),
  ];
}

function extractLookupTables(action: unknown): unknown[] {
  const a = action as Record<string, unknown>;
  const candidates = [
    a.preLoadedAddressLookupTables,
    a.lookupTableAddresses,
    a.lookupTables,
  ].filter(Array.isArray) as unknown[][];
  return candidates[0] ?? [];
}

export async function getPreflight(wallet: string, mint?: string): Promise<{
  solLamports: number;
  usdcAmount: number;
  hasSol: boolean;
  hasUsdc: boolean;
  minSolRecommended: number;
}> {
  const { rpc, cfg, kit } = await loadMarket();
  const anyRpc = rpc as unknown as {
    getBalance: (a: unknown) => { send: () => Promise<{ value: bigint }> };
    getTokenAccountsByOwner: (
      owner: unknown,
      filter: unknown,
      opts: { encoding: string },
    ) => {
      send: () => Promise<{
        value: Array<{ account: { data: { parsed: { info: { tokenAmount: { amount: string; decimals: number } } } } } }>;
      }>;
    };
  };
  const owner = kit.address(wallet);
  const { value: lamports } = await anyRpc.getBalance(owner).send();
  const solLamports = Number(lamports);

  const targetMint = mint ?? cfg.usdcMint;
  let usdcAmount = 0;
  try {
    const accounts = await anyRpc
      .getTokenAccountsByOwner(
        owner,
        { mint: kit.address(targetMint) },
        { encoding: 'jsonParsed' },
      )
      .send();
    const total = accounts.value.reduce((sum, acc) => {
      const info = acc.account.data.parsed.info.tokenAmount;
      return sum + Number(info.amount) / 10 ** info.decimals;
    }, 0);
    usdcAmount = total;
  } catch (err) {
    console.warn('[kamino preflight] token balance check failed', err);
  }
  const minSolRecommended = 0.01;
  return {
    solLamports,
    usdcAmount,
    hasSol: solLamports >= minSolRecommended * 1e9,
    hasUsdc: usdcAmount > 0,
    minSolRecommended,
  };
}

async function assertSignature(signature: string): Promise<void> {
  const cfg = getKaminoConfig();
  const { kit } = await loadKit();
  const rpc = kit.createSolanaRpc(cfg.rpcUrl);
  const r = rpc as unknown as {
    getSignatureStatuses: (sigs: string[]) => {
      send: () => Promise<{ value: Array<{ confirmationStatus?: string; err?: unknown } | null> }>;
    };
  };
  const { value } = await r.getSignatureStatuses([signature]).send();
  const st = value[0];
  if (!st || !st.confirmationStatus) throw new Error(`Transaction ${signature} not on-chain yet`);
  if (st.err) throw new Error(`Transaction ${signature} failed: ${JSON.stringify(st.err)}`);
}

export const realKaminoDriver: KaminoDriver = {
  async getCurrentApy(): Promise<number> {
    const { reserve, rpc } = await resolveReserve();
    const slot = await getCurrentSlot(rpc);
    const apy = reserve.totalSupplyAPY(slot);
    return apy > 1 ? apy : apy * 100;
  },

  async getPosition(wallet: string): Promise<KaminoPosition | null> {
    try {
      const { market, reserve, rpc, cfg, kit, klend } = await resolveReserve();
      const owner = kit.address(wallet);
      const obligationType = new klend.VanillaObligation(kit.address(cfg.programId));
      const obligation = await market.getObligationByWallet(owner, obligationType);
      if (!obligation) return null;
      const deposit = obligation.getDepositByReserve(reserve.address);
      if (!deposit) return null;

      const decimals = reserve.stats.decimals;
      const supplied = Number(deposit.amount.toString()) / 10 ** decimals;
      const currentValue = Number(deposit.marketValueRefreshed.toString()) / 10 ** decimals;
      const slot = await getCurrentSlot(rpc);
      const apyRaw = reserve.totalSupplyAPY(slot);
      const apy = apyRaw > 1 ? apyRaw : apyRaw * 100;

      return {
        usdcSupplied: supplied,
        usdcCurrentValue: currentValue,
        apy,
        obligationPubkey: null,
      };
    } catch (err) {
      console.error('[kamino real] getPosition failed', err);
      return null;
    }
  },

  async prepareDeposit(
    wallet: string,
    amountUSDC: number,
    opts?: DepositOpts,
  ): Promise<PreparedTx> {
    const pre = await getPreflight(wallet, opts?.targetMint);
    if (!pre.hasSol) {
      throw new Error(
        `Saldo SOL insuficiente para taxa de rede. Você tem ${(pre.solLamports / 1e9).toFixed(
          4,
        )} SOL, precisa de pelo menos ${pre.minSolRecommended} SOL.`,
      );
    }
    if (pre.usdcAmount < amountUSDC) {
      throw new Error(
        `Saldo insuficiente para depósito no ${opts?.targetLabel ?? 'reserve'}. Disponível: ${pre.usdcAmount.toFixed(
          4,
        )}, solicitado: ${amountUSDC.toFixed(4)}.`,
      );
    }

    const { market, reserve, rpc, cfg, kit, klend } = await resolveReserve({
      targetMint: opts?.targetMint,
    });
    const decimals = reserve.stats.decimals;
    const amount = BigInt(Math.round(amountUSDC * 10 ** decimals)).toString();
    const signer = kit.createNoopSigner(kit.address(wallet));
    const obligationType = new klend.VanillaObligation(kit.address(cfg.programId));

    const action = await klend.KaminoAction.buildDepositTxns(
      market,
      amount,
      reserve.getLiquidityMint(),
      signer,
      obligationType,
      true,
      undefined,
      0,
    );

    const instructions = collectIxs(action);
    const lookupTables = extractLookupTables(action);
    const txBase64 = await buildTxBase64({
      kit,
      rpc,
      feePayer: wallet,
      instructions,
      lookupTableAddresses: lookupTables,
    });

    return {
      txBase64,
      lookupTables: lookupTables.map((l) => String(l)),
    };
  },

  async prepareWithdraw(
    wallet: string,
    amountUSDC: number,
    opts?: DepositOpts,
  ): Promise<PreparedTx> {
    const pre = await getPreflight(wallet, opts?.targetMint);
    if (!pre.hasSol) {
      throw new Error(
        `Saldo SOL insuficiente para gas. Você tem ${(pre.solLamports / 1e9).toFixed(
          4,
        )} SOL, precisa de pelo menos ${pre.minSolRecommended} SOL.`,
      );
    }

    const { market, reserve, rpc, cfg, kit, klend } = await resolveReserve({
      targetMint: opts?.targetMint,
    });
    const decimals = reserve.stats.decimals;
    const amount = BigInt(Math.round(amountUSDC * 10 ** decimals)).toString();
    const signer = kit.createNoopSigner(kit.address(wallet));
    const obligationType = new klend.VanillaObligation(kit.address(cfg.programId));

    const action = await klend.KaminoAction.buildWithdrawTxns(
      market,
      amount,
      reserve.getLiquidityMint(),
      signer,
      obligationType,
      true,
      undefined,
      0,
    );

    const instructions = collectIxs(action);
    const lookupTables = extractLookupTables(action);
    const txBase64 = await buildTxBase64({
      kit,
      rpc,
      feePayer: wallet,
      instructions,
      lookupTableAddresses: lookupTables,
    });

    return {
      txBase64,
      lookupTables: lookupTables.map((l) => String(l)),
    };
  },

  async deposit() {
    throw new Error('Use prepareDeposit + Privy sendTransaction client-side.');
  },

  async withdraw() {
    throw new Error('Use prepareWithdraw + Privy sendTransaction client-side.');
  },

  async confirmDeposit(wallet: string, signature: string, amountUSDC: number): Promise<void> {
    await assertSignature(signature);
    console.log(
      `[kamino ${getKaminoConfig().env}] deposit ${signature} · ${amountUSDC} · ${wallet}`,
    );
  },

  async confirmWithdraw(wallet: string, signature: string, amountUSDC: number): Promise<void> {
    await assertSignature(signature);
    console.log(
      `[kamino ${getKaminoConfig().env}] withdraw ${signature} · ${amountUSDC} · ${wallet}`,
    );
  },
};
