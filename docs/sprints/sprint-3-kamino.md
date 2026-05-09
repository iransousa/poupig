# Sprint 3 — Kamino Lending (dia 2 manhã)

**Objetivo**: USDC recebido via on-ramp vai automaticamente para Kamino Lend. Withdraw também funciona.

## Entregáveis
- [ ] Helper `lib/kamino/` com load market, deposit, withdraw, read position
- [ ] Fee sponsoring Privy habilitado
- [ ] Após on-ramp `paid`, dispara deposit automático
- [ ] Endpoint `POST /api/kamino/prepare-deposit` retorna tx serializada
- [ ] Frontend assina via Privy e envia
- [ ] Endpoint `POST /api/kamino/prepare-withdraw`
- [ ] Atualização de `kamino_positions` após cada op
- [ ] Retry em falha (job idempotente)

## Implementação

### Load market (server-side ou shared)
```typescript
// lib/kamino/market.ts
import { KaminoMarket } from '@kamino-finance/klend-sdk';

export async function loadMainMarket(connection: Connection) {
  return KaminoMarket.load(connection, new PublicKey(MAIN_MARKET));
}
```

### Prepare deposit (backend)
```typescript
// /api/kamino/prepare-deposit/route.ts
const { amountUSDC } = await req.json();
const market = await loadMainMarket(connection);
const reserve = market.getReserveBySymbol('USDC');

const { instructions, lookupTables } = await buildDepositIxs({
  market, reserve,
  owner: user.walletAddress,
  amount: new BN(amountUSDC * 1e6),
});

const tx = buildVersionedTransaction(instructions, lookupTables, feePayer);
return Response.json({ tx: tx.serialize().toString('base64') });
```

### Client side
```typescript
const { sendTransaction } = useSendTransaction();

async function deposit(amount: number) {
  const { tx } = await fetch('/api/kamino/prepare-deposit', { ... }).then(r => r.json());
  const deserialized = VersionedTransaction.deserialize(Buffer.from(tx, 'base64'));
  const sig = await sendTransaction({ transaction: deserialized, connection });
  await fetch('/api/kamino/confirm', { body: JSON.stringify({ sig }) });
}
```

### Auto-deposit após on-ramp
No handler do webhook 4P:
```typescript
if (status === 'paid' && kind === 'onramp') {
  await enqueueKaminoDeposit({ userId, amountUSDC });
}
```

Job processor:
- Pega saldo USDC real on-chain
- Monta tx de deposit
- Envia pra queue de "pending client signature" OU executa auto se fee sponsor + delegated signing tiver sido configurado

**Decisão**: no MVP, deposit acontece quando user abre o app. UI mostra "USDC recebido, aplicar agora? [Sim]". Clica → assina → deposit.

### Read position
```typescript
// lib/kamino/position.ts
export async function getPosition(connection: Connection, owner: PublicKey) {
  const market = await loadMainMarket(connection);
  const obligation = await market.getObligationByWallet(owner, market.getAddress());
  if (!obligation) return null;
  
  const usdcReserve = market.getReserveBySymbol('USDC');
  const supplied = obligation.getDepositByReserve(usdcReserve.address);
  const apy = usdcReserve.totalSupplyAPY();
  
  return {
    usdcSupplied: supplied.amount,
    usdcValue: supplied.marketValueRefreshed,
    apy,
  };
}
```

## Critério de pronto
- Depósito de R$ 1 resulta em posição Kamino visível no app e na Kamino UI oficial
- Withdraw reverte a posição
- APY exibido bate com Kamino UI
- `kamino_positions` atualizado após cada op
