import { db } from '@/lib/db/client';
import { feeConfig, feesCollected, transactions, type FeeConfig } from '@/lib/db/schema';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

export type ComputedFees = {
  grossBrl: number;
  feeBrl: number;
  netBrl: number;
  breakdown: Array<{ kind: FeeKind; amountBrl: number }>;
};

export type FeeKind =
  | 'onramp_fixed'
  | 'onramp_percent'
  | 'offramp_fixed'
  | 'offramp_percent'
  | 'performance';

export type FeeConfigView = {
  onrampFixedBrl: number;
  onrampPercentBps: number;
  offrampFixedBrl: number;
  offrampPercentBps: number;
  performancePercentBps: number;
  minDepositBrl: number;
  maxDepositBrl: number;
  minWithdrawBrl: number;
  maxWithdrawBrl: number;
  dailyMaxBrl: number;
  monthlyMaxBrl: number;
};

const DEFAULT_CONFIG: FeeConfigView = {
  onrampFixedBrl: 0,
  onrampPercentBps: 0,
  offrampFixedBrl: 0,
  offrampPercentBps: 0,
  performancePercentBps: 0,
  minDepositBrl: 1,
  maxDepositBrl: 5000,
  minWithdrawBrl: 1,
  maxWithdrawBrl: 5000,
  dailyMaxBrl: 10000,
  monthlyMaxBrl: 100000,
};

export async function loadFeeConfig(): Promise<FeeConfigView> {
  const [row] = await db.select().from(feeConfig).orderBy(desc(feeConfig.updatedAt)).limit(1);
  if (!row) return DEFAULT_CONFIG;
  return fromRow(row);
}

function fromRow(row: FeeConfig): FeeConfigView {
  return {
    onrampFixedBrl: Number(row.onrampFixedBrl),
    onrampPercentBps: row.onrampPercentBps,
    offrampFixedBrl: Number(row.offrampFixedBrl),
    offrampPercentBps: row.offrampPercentBps,
    performancePercentBps: row.performancePercentBps,
    minDepositBrl: Number(row.minDepositBrl),
    maxDepositBrl: Number(row.maxDepositBrl),
    minWithdrawBrl: Number(row.minWithdrawBrl),
    maxWithdrawBrl: Number(row.maxWithdrawBrl),
    dailyMaxBrl: Number(row.dailyMaxBrl),
    monthlyMaxBrl: Number(row.monthlyMaxBrl),
  };
}

export function computeOnrampFees(amountBrl: number, cfg: FeeConfigView): ComputedFees {
  const fixed = cfg.onrampFixedBrl;
  const percent = (amountBrl * cfg.onrampPercentBps) / 10_000;
  const feeBrl = Number((fixed + percent).toFixed(2));
  const netBrl = Math.max(0, Number((amountBrl - feeBrl).toFixed(2)));
  return {
    grossBrl: amountBrl,
    feeBrl,
    netBrl,
    breakdown: [
      ...(fixed > 0 ? [{ kind: 'onramp_fixed' as const, amountBrl: fixed }] : []),
      ...(percent > 0 ? [{ kind: 'onramp_percent' as const, amountBrl: Number(percent.toFixed(2)) }] : []),
    ],
  };
}

export function computeOfframpFees(amountBrl: number, cfg: FeeConfigView): ComputedFees {
  const fixed = cfg.offrampFixedBrl;
  const percent = (amountBrl * cfg.offrampPercentBps) / 10_000;
  const feeBrl = Number((fixed + percent).toFixed(2));
  const netBrl = Math.max(0, Number((amountBrl - feeBrl).toFixed(2)));
  return {
    grossBrl: amountBrl,
    feeBrl,
    netBrl,
    breakdown: [
      ...(fixed > 0 ? [{ kind: 'offramp_fixed' as const, amountBrl: fixed }] : []),
      ...(percent > 0 ? [{ kind: 'offramp_percent' as const, amountBrl: Number(percent.toFixed(2)) }] : []),
    ],
  };
}

export async function recordFees(opts: {
  transactionId: string;
  userId: string;
  breakdown: Array<{ kind: FeeKind; amountBrl: number; amountUsdc?: number }>;
}) {
  if (opts.breakdown.length === 0) return;
  await db.insert(feesCollected).values(
    opts.breakdown.map((b) => ({
      transactionId: opts.transactionId,
      userId: opts.userId,
      kind: b.kind,
      amountBrl: b.amountBrl.toFixed(2),
      amountUsdc: b.amountUsdc ? b.amountUsdc.toFixed(6) : null,
    })),
  );
}

/**
 * Valida limites antes de criar uma transação.
 * Retorna `{ ok: true }` ou `{ ok: false, error, message }`.
 */
export async function validateLimits(opts: {
  userId: string;
  kind: 'onramp' | 'offramp';
  amountBrl: number;
  cfg: FeeConfigView;
}): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  const { userId, kind, amountBrl, cfg } = opts;

  const min = kind === 'onramp' ? cfg.minDepositBrl : cfg.minWithdrawBrl;
  const max = kind === 'onramp' ? cfg.maxDepositBrl : cfg.maxWithdrawBrl;

  if (amountBrl < min) {
    return {
      ok: false,
      error: 'below_minimum',
      message: `Valor mínimo por ${kind === 'onramp' ? 'depósito' : 'saque'}: R$ ${min.toFixed(2)}`,
    };
  }
  if (amountBrl > max) {
    return {
      ok: false,
      error: 'above_maximum',
      message: `Valor máximo por ${kind === 'onramp' ? 'depósito' : 'saque'}: R$ ${max.toFixed(2)}`,
    };
  }

  // Limites acumulados (diário + mensal) — só conta transações paid + processing + pending
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [aggDaily] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amountBrl}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, kind),
        inArray(transactions.status, ['pending', 'processing', 'paid']),
        gte(transactions.createdAt, startOfDay),
      ),
    );

  const dailyUsed = Number(aggDaily?.total ?? 0);
  if (dailyUsed + amountBrl > cfg.dailyMaxBrl) {
    return {
      ok: false,
      error: 'daily_limit_exceeded',
      message: `Limite diário de ${kind === 'onramp' ? 'depósito' : 'saque'} (R$ ${cfg.dailyMaxBrl.toFixed(2)}) seria ultrapassado. Usado hoje: R$ ${dailyUsed.toFixed(2)}`,
    };
  }

  const [aggMonthly] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amountBrl}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, kind),
        inArray(transactions.status, ['pending', 'processing', 'paid']),
        gte(transactions.createdAt, startOfMonth),
      ),
    );

  const monthlyUsed = Number(aggMonthly?.total ?? 0);
  if (monthlyUsed + amountBrl > cfg.monthlyMaxBrl) {
    return {
      ok: false,
      error: 'monthly_limit_exceeded',
      message: `Limite mensal de ${kind === 'onramp' ? 'depósito' : 'saque'} (R$ ${cfg.monthlyMaxBrl.toFixed(2)}) seria ultrapassado. Usado no mês: R$ ${monthlyUsed.toFixed(2)}`,
    };
  }

  return { ok: true };
}
