# Sprint 4 — Dashboard + Yield Diário (dia 2 tarde)

**Objetivo**: tela principal bonita e simples mostrando saldo em BRL, rendimento, e gráfico.

## Entregáveis
- [ ] Tela `/app` com 4 blocos: saldo, rendimento hoje, rendimento mês, APY
- [ ] Gráfico últimos 30 dias (Recharts, área)
- [ ] Botões grandes: "Depositar" / "Sacar"
- [ ] Cron `/api/cron/daily-snapshot` (00:00 BRT)
- [ ] Histórico de transações (últimas 10)
- [ ] Design mobile-first

## Cron diário
```typescript
// /api/cron/daily-snapshot/route.ts
export async function GET() {
  const users = await db.select().from(usersTable)
    .innerJoin(kaminoPositions, eq(users.id, kaminoPositions.userId));
  
  for (const { user, position } of users) {
    const pos = await getPosition(connection, new PublicKey(user.solanaWalletAddress));
    if (!pos) continue;
    
    const quote = await fourP.priceConversion({
      amount: pos.usdcValue.toString(),
      from: 'USDC', to: 'BRL',
    });
    
    await db.insert(dailyYieldSnapshots).values({
      userId: user.id,
      snapshotDate: today,
      usdcSupplied: position.usdcSupplied,
      usdcCurrentValue: pos.usdcValue,
      apy: pos.apy,
      brlQuote: quote.result,
      usdcBrlRate: quote.rate,
    }).onConflictDoUpdate(...);
  }
}
```

Configuração Vercel cron em `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/daily-snapshot", "schedule": "0 3 * * *" },
    { "path": "/api/cron/reconcile-4p", "schedule": "*/5 * * * *" }
  ]
}
```

## Cálculo de rendimento (API `/api/yield`)
```typescript
const snapshots = await db.select().from(dailyYieldSnapshots)
  .where(eq(dailyYieldSnapshots.userId, userId))
  .orderBy(desc(dailyYieldSnapshots.snapshotDate))
  .limit(30);

const today = snapshots[0];
const yesterday = snapshots[1];
const monthStart = snapshots.find(s => s.snapshotDate === firstOfMonth);

return {
  currentBalanceBRL: today.brlQuote,
  yieldTodayBRL: today.brlQuote - yesterday.brlQuote,
  yieldMonthBRL: today.brlQuote - monthStart.brlQuote,
  apy: today.apy,
  series: snapshots.reverse().map(s => ({ date: s.snapshotDate, brl: s.brlQuote })),
};
```

## UI blocos

### Card saldo
```
┌───────────────────────────────┐
│ Saldo total                   │
│ R$ 1.542,30                   │
│ ≈ 280,45 USDC                 │
└───────────────────────────────┘
```

### Card rendimento hoje
```
┌───────────────────────────────┐
│ Rendeu hoje                   │
│ + R$ 0,25                     │
│ APY atual: 5,8%               │
└───────────────────────────────┘
```

### Gráfico
Área chart, eixo X = últimos 30 dias, eixo Y = saldo BRL.

### Histórico
Lista: ícone entrada/saída, valor BRL, data, status badge.

## Critério de pronto
- User com saldo > 0 vê números corretos
- Gráfico renderiza 30 dias (mesmo com poucos pontos, interpola)
- Cron diário roda em prod
- Mobile: layout funciona em 375px
