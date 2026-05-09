# Integração Kamino Lend

Docs: https://docs.kamino.finance/
SDK: `@kamino-finance/klend-sdk`
RPC: via Helius ou QuickNode (endpoint em `SOLANA_RPC_URL`)

## Por que Kamino
- Maior TVL em lending Solana (~USD 1,5B+ em 2025)
- APY USDC historicamente estável (5-8%)
- SDK TypeScript maduro com helpers de deposit/withdraw/read
- Reserva USDC no Main Market é battle-tested

## Conceitos
- **Reserve** — pool de um asset (ex: USDC Reserve)
- **Obligation** — posição do user (colaterais + empréstimos)
- **kToken** — token de recibo da posição (ex: kUSDC)
- Pra MVP: usamos só **supply USDC** (sem borrow), user é lender puro

## Operações necessárias

### 1. Deposit USDC
**Quando**: após on-ramp confirmada, USDC chegou na wallet do user.

Fluxo:
```typescript
const market = await KaminoMarket.load(connection, MAIN_MARKET_PUBKEY);
const reserve = market.getReserveBySymbol('USDC');

const { instructions, lookupTables } = await deposit({
  market,
  reserve,
  owner: userPublicKey,
  amount: new BN(usdcAmountLamports), // USDC tem 6 decimais
});

// Montar tx, assinar via Privy client-side, enviar
```

**Assinatura**: client-side via Privy SDK. Backend prepara instructions, envia ao frontend, Privy assina e envia.

### 2. Withdraw USDC
**Quando**: user solicitou saque → precisamos de USDC liquido na wallet antes de criar off-ramp na 4P.

```typescript
const { instructions } = await withdraw({
  market,
  reserve,
  owner: userPublicKey,
  amount: new BN(usdcAmountToWithdraw),
});
```

### 3. Leitura de posição
**Quando**: toda vez que mostrar saldo + cron de snapshot diário.

```typescript
const obligation = await market.getObligationByWallet(userPublicKey, MAIN_MARKET_PUBKEY);
const usdcDeposited = obligation.getDepositByReserve(usdcReserve.address);
// retorna amount + valor em USD
const apy = usdcReserve.calculateSupplyAPY();
```

## Schema no DB

Tabela `kamino_positions`:
- `user_id` (FK)
- `market_pubkey`
- `obligation_pubkey`
- `usdc_supplied` (numeric, unidade de USDC)
- `last_synced_at`

Atualizada por:
- Cada deposit/withdraw bem-sucedido
- Cron de snapshot diário

## Snapshot diário

Cron `0 3 * * *` (00:00 BRT):
```
FOR each user WHERE has obligation:
  obligation = kamino.getObligation(user.wallet)
  usdc_value = obligation.depositValueUSDC
  brl_quote = 4p.price_conversion(USDC → BRL, usdc_value)
  
  INSERT daily_yield_snapshots (
    user_id,
    date,
    usdc_supplied,
    usdc_value,  // com yield acumulado
    apy,
    brl_quote,
  )
```

Uso no dashboard:
- **Rendimento hoje** = snapshot[today].usdc_value − snapshot[yesterday].usdc_value
- **Rendimento mês** = snapshot[today].usdc_value − snapshot[month_start].usdc_value
- **Gráfico**: série temporal dos últimos 30 dias

## Tratamento de falhas

### Deposit falhou após on-ramp
USDC já está na wallet do user. Cron de retry tenta novamente. User pode usar dashboard "depósito aguardando aplicação" como fallback UI.

### Withdraw falhou no meio do saque
USDC volta/fica na wallet. Backend detecta via leitura, cria off-ramp normalmente OU aborta e exibe erro ao user.

### Slippage / reserva pausada
Verificar `reserve.status()` antes de deposit. Se pausada, bloquear UI e alertar equipe.

## Taxas e custos
- **Gas Solana**: ~0.00001 SOL por tx (~R$ 0,001). Backend patrocina via session signer? **TODO definir**: ou user precisa ter SOL? Privy pode automatizar fee payer.
- **Kamino não cobra fee** direto no deposit/withdraw (spread já está no APY).

## Alternativas futuras (v2)
- **MarginFi**: diversificar yield
- **Drift**: yields de perp funding, APYs maiores
- **Allocator próprio**: roteia entre protocolos baseado em APY + risco

## Checklist de integração
- [ ] `SOLANA_RPC_URL` em env (Helius/QuickNode)
- [ ] `KAMINO_MARKET_PUBKEY` main market em env
- [ ] SDK instalado: `@kamino-finance/klend-sdk`
- [ ] Fee payer configurado no Privy (usuário não precisa ter SOL)
- [ ] Endpoint `/api/kamino/prepare-deposit` retorna instructions
- [ ] Endpoint `/api/kamino/prepare-withdraw` retorna instructions
- [ ] Cron diário testado
