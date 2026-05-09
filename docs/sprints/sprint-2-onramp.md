# Sprint 2 — On-ramp PIX (dia 1 tarde)

**Objetivo**: usuário deposita BRL via PIX e USDC chega na wallet Solana.

## Entregáveis
- [ ] Cliente HTTP 4P (`lib/four-p/client.ts`) com retry e logs
- [ ] Tela `/app/deposit`: input BRL, preview USDC, botão confirmar
- [ ] Geração de QR + copia-e-cola
- [ ] Webhook handler `/api/webhooks/4p`
- [ ] Cron reconciliação `/api/cron/reconcile-4p` (cada 5min)
- [ ] Estados de transação corretos
- [ ] Histórico exibindo a transação

## Implementação

### Cliente 4P
```typescript
// lib/four-p/client.ts
export async function createPixTransaction(input: {
  userId: string;
  cpf: string;
  email: string;
  amountBRL: number;
  receiverWallet: string;
}) {
  const customId = crypto.randomUUID();
  const token = crypto.randomUUID();
  
  const res = await fetch(`${FOUR_P_BASE}/v1/pix/transaction`, {
    method: 'PUT',
    headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      cpf, email,
      amount: input.amountBRL,
      expires: 3600,
      custom_id: customId,
      custom_data: { receiver_wallet: input.receiverWallet },
      description: 'Depósito PoupApp',
      notification_url: `${APP_URL}/api/webhooks/4p?token=${token}`,
    }),
  });
  // ...
}
```

### Fluxo da UI
1. User digita "R$ 50"
2. `POST /api/quote` → mostra "≈ 9.21 USDC"
3. User confirma
4. `POST /api/deposit/create`:
   - insere `transactions(status: pending)`
   - chama `createPixTransaction`
   - retorna `pixCopiaECola` + `qr`
5. Modal/tela mostra QR + copy button
6. Polling `GET /api/transactions/:id` a cada 3s OU SSE/WebSocket

### Webhook
```typescript
// /api/webhooks/4p/route.ts
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for');
  if (!ip?.includes('44.196.63.157')) return new Response(null, { status: 403 });
  
  const token = new URL(req.url).searchParams.get('token');
  const { token: bodyToken } = await req.json();
  
  // async processar
  queueMicrotask(() => processNotification(bodyToken));
  
  return Response.json({ ok: true });
}

async function processNotification(token: string) {
  const data = await fourP.getNotification(token);
  // idempotência via UNIQUE em transaction_events.notification_token
  await db.insert(transactionEvents).values({
    notification_token: token,
    payload: data,
    // ...
  }).onConflictDoNothing();
  
  // atualiza transaction
  // dispara kamino deposit (Sprint 3)
}
```

### Reconciliação (cron)
```typescript
// /api/cron/reconcile-4p/route.ts
export async function GET() {
  const pending = await db.select().from(transactions)
    .where(and(
      eq(transactions.status, 'pending'),
      lt(transactions.created_at, sql`now() - interval '5 minutes'`),
    ));
  
  for (const tx of pending) {
    // GET notification ou GET transaction na 4P
    // se status mudou, atualiza
  }
}
```

## Testes manuais
1. Cria PIX de R$ 0,01
2. Paga no app bancário
3. Verifica webhook chegou (logs)
4. Verifica USDC na wallet via explorer
5. Verifica `transactions.status = 'paid'`

## Critério de pronto
- Depósito de R$ 0,01 em prod funciona fim-a-fim
- Webhook deduplicação funciona (processar 2x não dobra nada)
- Cron reconcilia transações que perderam webhook
- UI mostra estado em tempo quase real
