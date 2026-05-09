/**
 * In-process scheduler — roda crons dentro do próprio processo Next.js.
 * Útil quando NÃO usa Vercel (que tem cron próprio).
 *
 * Habilitação:
 *   ENABLE_IN_PROCESS_CRON=true no .env
 *
 * Inicia automaticamente ao primeiro acesso a uma API route.
 * Para forçar inicialização cedo, importe `ensureSchedulerStarted()` no layout.
 */

import { env } from '@/env';

type ScheduledJob = {
  name: string;
  intervalMs: number;
  fn: () => Promise<void>;
  lastRunAt?: number;
};

const JOBS: ScheduledJob[] = [];
let started = false;
let timer: NodeJS.Timeout | null = null;

const g = globalThis as unknown as { __poupappSchedulerStarted?: boolean };

export function registerJob(job: ScheduledJob) {
  if (JOBS.some((j) => j.name === job.name)) return;
  JOBS.push(job);
}

async function tick() {
  const now = Date.now();
  for (const job of JOBS) {
    const lastRun = job.lastRunAt ?? 0;
    if (now - lastRun >= job.intervalMs) {
      job.lastRunAt = now;
      try {
        console.log(`[scheduler] ${job.name} running`);
        await job.fn();
        console.log(`[scheduler] ${job.name} done`);
      } catch (err) {
        console.error(`[scheduler] ${job.name} failed`, err);
      }
    }
  }
}

export function ensureSchedulerStarted() {
  if (g.__poupappSchedulerStarted) return;
  if (started) return;
  if (env.ENABLE_IN_PROCESS_CRON !== 'true') return;
  started = true;
  g.__poupappSchedulerStarted = true;
  console.log('[scheduler] started');

  // Reconcile 4P a cada 1 min
  // Só processa txs que JÁ têm o notification token da 4P (webhook chegou).
  // Sem o token, nada a fazer (4P não tem notification ainda — usuário não pagou).
  registerJob({
    name: 'reconcile-4p',
    intervalMs: 60_000,
    fn: async () => {
      const { syncTransactionFromToken } = await import('@/lib/four-p/reconcile');
      const { db } = await import('@/lib/db/client');
      const { transactions } = await import('@/lib/db/schema');
      const { and, isNotNull, lt, inArray, sql } = await import('drizzle-orm');
      const rows = await db
        .select({
          id: transactions.id,
          token: transactions.fourPNotificationToken,
        })
        .from(transactions)
        .where(
          and(
            inArray(transactions.status, ['pending', 'processing']),
            isNotNull(transactions.fourPNotificationToken),
            lt(transactions.createdAt, sql`now() - interval '30 seconds'`),
          ),
        )
        .limit(20);
      for (const r of rows) {
        if (!r.token) continue;
        try {
          await syncTransactionFromToken(r.token, r.id);
        } catch (err) {
          console.error('[scheduler] reconcile failed for', r.id, err);
        }
      }
    },
  });

  // Daily snapshot a cada 6 horas (idempotente: só grava 1 row por dia)
  registerJob({
    name: 'daily-snapshot',
    intervalMs: 6 * 60 * 60_000,
    fn: async () => {
      const url = `${env.NEXT_PUBLIC_APP_URL}/api/cron/daily-snapshot?secret=${env.CRON_SECRET ?? ''}`;
      try {
        await fetch(url);
      } catch (err) {
        console.error('[scheduler] daily-snapshot fetch failed', err);
      }
    },
  });

  timer = setInterval(tick, 15_000);
  // primeiro tick imediato
  setTimeout(tick, 5_000);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
  g.__poupappSchedulerStarted = false;
}
