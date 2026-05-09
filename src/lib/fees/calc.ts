import { db } from '@/lib/db/client';
import { feeConfig, feesCollected, type FeeConfig } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

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

const DEFAULT_CONFIG: FeeConfigView = {
  onrampFixedBrl: 0,
  onrampPercentBps: 0,
  offrampFixedBrl: 0,
  offrampPercentBps: 0,
  performancePercentBps: 0,
  minDepositBrl: 1,
  minWithdrawBrl: 1,
};

export type FeeConfigView = {
  onrampFixedBrl: number;
  onrampPercentBps: number;
  offrampFixedBrl: number;
  offrampPercentBps: number;
  performancePercentBps: number;
  minDepositBrl: number;
  minWithdrawBrl: number;
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
    minWithdrawBrl: Number(row.minWithdrawBrl),
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
