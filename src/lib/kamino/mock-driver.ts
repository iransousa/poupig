import type { KaminoDriver, KaminoPosition } from './types';

// APY acelerado pra demo ficar visível em segundos.
// Default 3650% (~10% por hora). Pode override via MOCK_KAMINO_APY env.
const MOCK_APY = Number(process.env.MOCK_KAMINO_APY ?? '3650');
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

type MockPos = {
  obligationPubkey: string;
  usdcSupplied: number;
  lastAccrualAt: number;
};

type KaminoGlobal = { positions: Map<string, MockPos>; rehydrated: Set<string> };
const g = globalThis as unknown as { __poupappMockKamino?: KaminoGlobal };
if (!g.__poupappMockKamino) {
  g.__poupappMockKamino = { positions: new Map(), rehydrated: new Set() };
}
const POSITIONS = g.__poupappMockKamino.positions;
const REHYDRATED = g.__poupappMockKamino.rehydrated;

function accrue(pos: MockPos): number {
  const now = Date.now();
  const elapsedSec = (now - pos.lastAccrualAt) / 1000;
  const ratePerSec = MOCK_APY / 100 / SECONDS_PER_YEAR;
  const grown = pos.usdcSupplied * (1 + ratePerSec * elapsedSec);
  pos.usdcSupplied = grown;
  pos.lastAccrualAt = now;
  return grown;
}

function randomSig() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < 88; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * Após restart do server o Map in-memory zera. Hidrata uma vez por wallet
 * lendo o último snapshot de `kaminoPositions`. A partir daí o APY acumula
 * a partir do valor gravado.
 */
async function rehydrate(wallet: string) {
  if (REHYDRATED.has(wallet) || POSITIONS.has(wallet)) return;
  REHYDRATED.add(wallet);
  try {
    const { db } = await import('@/lib/db/client');
    const { kaminoPositions, users } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({
        obligationPubkey: kaminoPositions.obligationPubkey,
        usdcCurrentValue: kaminoPositions.usdcCurrentValue,
      })
      .from(kaminoPositions)
      .innerJoin(users, eq(users.id, kaminoPositions.userId))
      .where(eq(users.solanaWalletAddress, wallet))
      .limit(1);
    const value = row ? Number(row.usdcCurrentValue) : 0;
    if (value > 0) {
      POSITIONS.set(wallet, {
        obligationPubkey: row?.obligationPubkey ?? `MockObl${randomSig().slice(0, 40)}`,
        usdcSupplied: value,
        lastAccrualAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('[kamino mock] rehydrate failed', err);
  }
}

export const mockKaminoDriver: KaminoDriver = {
  async getCurrentApy() {
    return MOCK_APY;
  },

  async getPosition(wallet: string): Promise<KaminoPosition | null> {
    await rehydrate(wallet);
    const pos = POSITIONS.get(wallet);
    if (!pos || pos.usdcSupplied <= 0) return null;
    const current = accrue(pos);
    return {
      usdcSupplied: Number(current.toFixed(6)),
      usdcCurrentValue: Number(current.toFixed(6)),
      apy: MOCK_APY,
      obligationPubkey: pos.obligationPubkey,
    };
  },

  async deposit(wallet: string, amountUSDC: number) {
    await rehydrate(wallet);
    let pos = POSITIONS.get(wallet);
    if (!pos) {
      pos = {
        obligationPubkey: `MockObl${randomSig().slice(0, 40)}`,
        usdcSupplied: 0,
        lastAccrualAt: Date.now(),
      };
      POSITIONS.set(wallet, pos);
    } else {
      accrue(pos);
    }
    pos.usdcSupplied += amountUSDC;
    return { signature: randomSig() };
  },

  async withdraw(wallet: string, amountUSDC: number) {
    await rehydrate(wallet);
    const pos = POSITIONS.get(wallet);
    if (!pos) throw new Error('no_position');
    const current = accrue(pos);
    if (current < amountUSDC) throw new Error('insufficient_balance');
    pos.usdcSupplied = current - amountUSDC;
    return { signature: randomSig() };
  },
};
