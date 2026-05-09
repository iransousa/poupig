# Plano de Arquitetura — MVP PoupApp

## Visão geral
MVP de poupança DeFi que abstrai a complexidade cripto pro usuário brasileiro: deposita via PIX em reais, a aplicação converte pra USDC em Solana e aplica em lending protocols (Kamino). Rendimento exibido diariamente em BRL.

## Princípios de design
1. **Cripto invisível**: usuário enxerga BRL. USDC/Solana/lending são implementação.
2. **Non-custodial**: chave privada nunca no servidor. Privy embedded wallet resolve UX.
3. **Stateless onde dá**: estado crítico on-chain; Postgres guarda espelho + dados off-chain (CPF, chave PIX, IDs 4P).
4. **Idempotência**: toda operação externa (4P, Kamino) usa `custom_id` único + reconciliação por webhook + cron de retry.

## Componentes

### 1. Next.js App (Frontend + API Routes)
**Frontend (App Router, RSC onde cabe):**
- `/` → landing + CTA login
- `/app` → dashboard principal (saldo, yield, botões)
- `/app/deposit` → fluxo PIX
- `/app/withdraw` → fluxo saque
- `/app/history` → histórico de transações

**API Routes (backend):**
- `POST /api/quote` → cotação BRL↔USDC
- `POST /api/deposit/create` → cria transação PIX na 4P
- `POST /api/withdraw/create` → cria off-ramp na 4P
- `POST /api/webhooks/4p` → recebe notificações 4P
- `GET /api/balance` → saldo + posição Kamino
- `GET /api/yield` → snapshots de rendimento
- `POST /api/kamino/deposit` → dispara deposit (assinatura client-side)
- `POST /api/kamino/withdraw` → dispara withdraw

### 2. Privy (Auth + Wallet)
- Login email, Google, SMS
- Cria **embedded Solana wallet** na primeira autenticação
- SDK client-side expõe `signAndSendTransaction`
- Server SDK valida sessão via JWT

### 3. 4P Finance
- On-ramp: PIX BRL → USDC direto na wallet Solana do user
- Off-ramp: USDC da wallet → PIX na chave do user
- Cotação ao vivo
- Webhook two-way (token → GET pra buscar dados)

Detalhes: [docs/integracoes/4p-finance.md](../integracoes/4p-finance.md)

### 4. Kamino Lend
- Deposit USDC → gera kTokens (posição)
- Withdraw USDC pelos kTokens
- Leitura de APY e saldo via SDK

Detalhes: [docs/integracoes/kamino-lending.md](../integracoes/kamino-lending.md)

### 5. Solana RPC
- Helius ou QuickNode (endpoints premium pra estabilidade)
- Usado por Privy (assinatura), Kamino SDK e scripts de leitura

### 6. Neon + Drizzle
- Postgres serverless com branching (útil pra dev/preview)
- Drizzle ORM + `drizzle-kit` pra migrations
- Schema documentado em [docs/banco-de-dados/schema.md](../banco-de-dados/schema.md)

### 7. Vercel Cron
- `0 3 * * *` (00:00 BRT) → snapshot diário de yield por user
- `*/5 * * * *` → reconciliação de transações 4P em estado `pending` há >5min

## Fluxos detalhados

### Fluxo: Depósito completo

```
┌─────┐                                 ┌─────────┐
│User │                                 │  4P API │
└──┬──┘                                 └────┬────┘
   │                                         │
   │ 1. Define R$ 100                        │
   ├─────────▶ POST /api/quote               │
   │          ├──────▶ price_conversion ─────▶
   │          ◀────── {usdc: 18.42} ─────────┤
   │                                         │
   │ 2. Confirma                             │
   ├─────────▶ POST /api/deposit/create      │
   │          ├─ INSERT transactions(pending)│
   │          ├──────▶ PUT /pix/transaction ─▶
   │          ◀────── {pixCopiaECola, txid} ─┤
   │          ◀─ {qr, copia_e_cola} ─────────┤
   │                                         │
   │ 3. Paga PIX externamente                │
   │                                         │
   │                                         │ 4. PIX confirmado
   │                                         │ 5. Cripto enviada
   │                                         │
   │                          POST webhook   │
   │          ◀────── {token: xyz} ──────────┤
   │          ├──────▶ GET /notification/xyz ▶
   │          ◀────── {status: paid, ...} ───┤
   │          ├─ UPDATE transactions(paid)   │
   │          ├─ Enqueue kamino_deposit job  │
   │                                         │
   │ 6. User recebe notif/vê saldo atualizado│
   │                                         │
   │          ┌── Job kamino_deposit ──┐     │
   │          │ Client assina via Privy │     │
   │          │ Deposit USDC no Kamino  │     │
   │          │ UPDATE position         │     │
   │          └─────────────────────────┘     │
```

### Fluxo: Saque completo

```
1. User solicita saque R$ 50
2. Backend: calcula USDC equivalente (quote)
3. Backend withdraw Kamino (USDC → wallet user)
4. Backend: PUT /cryptopix/transaction (4P) → retorna receiver_wallet
5. Client assina transfer USDC → receiver_wallet
6. 4P confirma on-chain → paga PIX ao user
7. Webhook → update transaction status
```

### Fluxo: Snapshot diário

```
Cron 00:00 BRT:
  FOR each user WHERE has_position:
    posição = kamino.getObligation(user.wallet)
    INSERT daily_yield_snapshots(user_id, usdc_supplied, usdc_value, apy, brl_quote)
  
Dashboard calcula:
  rendimento_hoje = snapshot[today].usdc_value - snapshot[yesterday].usdc_value
  rendimento_mes = snapshot[today].usdc_value - snapshot[month_start].usdc_value
```

## Segurança

### Autenticação
- Privy JWT validado no backend em toda API route
- Middleware Next.js rejeita requests sem JWT válido
- CPF e chave PIX criptografados em repouso (pgcrypto ou camada app)

### Webhooks 4P
- Whitelist IP `44.196.63.157` via middleware
- HTTPS obrigatório
- Token único por transação no query param (validado contra DB)
- Idempotência: notification_token guardado em `transaction_events` com unique constraint

### API Keys
- `FOUR_P_API_KEY` só em env var server-side
- Nunca expor em client ou logs
- Rotação planejada via painel 4P

### Chave privada
- Nunca no servidor. Privy guarda criptografada, assinatura no device do user.
- Backend NUNCA chama `signTransaction` no servidor.

## Observabilidade
- **Logs**: Vercel logs + Axiom (free tier) pra retenção
- **Erros**: Sentry (free tier)
- **Métricas**: tabela `transaction_events` serve como audit trail completo

## Ambientes
- **dev**: local + branch Neon `dev`
- **preview**: cada PR Vercel com branch Neon automática
- **prod**: `main` → Vercel prod + branch Neon `main`

## Questões em aberto
Ver seção "Pendências bloqueantes" no CLAUDE.md.
