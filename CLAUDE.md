# PoupApp — Savings DeFi em USDC/Solana

App de poupança estilo "Caixinha do Nubank" que converte BRL (via PIX) em USDC na rede Solana e aplica automaticamente em protocolos de lending (Kamino como default). Usuário vê rendimento diário em BRL de forma simples.

## Objetivo do MVP (Hackathon)
Demonstrar o fluxo end-to-end: **Onboarding → PIX → USDC em Solana → Lending no Kamino → Dashboard com yield diário → Saque via PIX**.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend/App | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts |
| Auth + Wallet | Privy (embedded Solana wallet, login email/Google) |
| On/Off-ramp PIX | **4P Finance** (BRL↔USDC direto em Solana) |
| Lending | **Kamino Lend** (`@kamino-finance/klend-sdk`) |
| Blockchain | Solana (`@solana/web3.js`) |
| Backend | Next.js API Routes + Node.js |
| Banco | **Neon** (Postgres serverless) + **Drizzle ORM** |
| Jobs | Vercel Cron (snapshot diário de yield + reconciliação webhooks) |
| Hosting | Vercel |

> Nota: **não usar Supabase**. DB = Neon + Drizzle. Auth = Privy (não NextAuth).

## Arquitetura de alto nível

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Next.js App  │────▶│ API Routes      │────▶│ Neon Postgres│
│ (Privy SDK)  │     │ (Backend BFF)   │     │ (Drizzle)    │
└──────┬───────┘     └────────┬────────┘     └──────────────┘
       │                      │
       │                      ├──▶ 4P Finance API (PIX on/off-ramp)
       │                      ├──▶ Kamino SDK (deposit/withdraw)
       │                      └──▶ Solana RPC (Helius/QuickNode)
       │
       └──▶ Privy (embedded wallet, signing client-side)
```

## Fluxos principais

### Depósito
1. User define valor em BRL → preview via `POST /v1/transaction/price_conversion`
2. Backend cria on-ramp: `PUT /v1/pix/transaction` com `receiver_wallet` = pubkey Solana do user
3. App exibe PIX Copia-e-Cola + QR
4. User paga → 4P entrega USDC na wallet do user (~10s)
5. Webhook 4P → backend busca status via `GET /v1/notification/:token`
6. Backend dispara deposit no Kamino (tx assinada via Privy)
7. Saldo atualizado no Postgres

### Saque
1. User solicita saque em BRL ou USDC
2. Backend withdraw do Kamino → USDC volta pra wallet do user
3. `PUT /v1/cryptopix/transaction` com destino = chave PIX do user
4. App assina tx USDC → wallet fornecida pela 4P
5. 4P confirma recebimento → paga PIX → webhook

### Yield diário
- Cron (00:00 BRT) lê posição Kamino de cada user e grava snapshot em `daily_yield_snapshots`
- Dashboard calcula rendimento do dia/semana/mês a partir dos snapshots

## Escopo do MVP

### Core (obrigatório pro hackathon)
- [ ] Login Privy + coleta de CPF/email no onboarding
- [ ] Criação automática de wallet Solana embutida
- [ ] Depósito via PIX → USDC → Kamino
- [ ] Dashboard: saldo total em BRL, rendimento hoje/mês, gráfico de evolução
- [ ] Saque via PIX
- [ ] Webhooks 4P (on-ramp + off-ramp) com retry
- [ ] Cron de snapshot diário

### Nice-to-have (v2)
- [ ] Múltiplas "caixinhas" com metas
- [ ] Diversificação entre Kamino/MarginFi/Drift
- [ ] Notificações (email/push)
- [ ] Histórico detalhado de transações on-chain

## Planejamento

### [EXECUTADO] Sprint 0 — Setup (dia 0)
Documento: [docs/sprints/sprint-0-setup.md](docs/sprints/sprint-0-setup.md)
- [x] Bootstrap Next.js 14 + TS + Tailwind
- [x] Privy SDK instalado (client + server) + providers configurados
- [x] Drizzle schema completo (users, transactions, events, kamino_positions, snapshots, retries)
- [x] Neon driver + cliente DB
- [x] Cliente 4P (priceConversion, on-ramp, off-ramp, getNotification)
- [x] Helpers Solana, Privy server, criptografia AES-256-GCM
- [x] Landing page + rotas `/app` protegidas + dashboard placeholder
- [x] `.env.example`, `drizzle.config.ts`, `vercel.json` com crons
- [x] `pnpm typecheck` passando

### [EXECUTADO] Sprint 1 — Onboarding + Wallet (dia 1 manhã)
Documento: [docs/sprints/sprint-1-onboarding.md](docs/sprints/sprint-1-onboarding.md)
- [x] Validadores CPF (algoritmo de dígitos) e chave PIX (email/cpf/cnpj/phone/random)
- [x] `requireSession()` helper verifica JWT Privy via `Authorization: Bearer`
- [x] `POST /api/users/register` — valida entrada, criptografa CPF/PIX, insere/atualiza user
- [x] `GET /api/users/me` — retorna user + flag `onboarded`
- [x] Cliente API com Privy access token (`apiFetch`) + hook `useMe`
- [x] Página `/onboarding` — form com máscara de CPF + validação inline + toast
- [x] Layout `(app)` redireciona pra `/onboarding` se `onboarded=false`
- [x] Landing redireciona user logado pra `/app` ou `/onboarding`
- [x] Dashboard exibe nome + wallet Solana do user
- [x] `pnpm typecheck` passando

### [EXECUTADO] Sprint 2 — On-ramp (dia 1 tarde) · modo mock
Documento: [docs/sprints/sprint-2-onramp.md](docs/sprints/sprint-2-onramp.md)
- [x] Driver 4P abstraído: `realDriver` vs `mockDriver` selecionado por `FOUR_P_DRIVER` env var
- [x] Mock in-memory simula quote (1 USDC = R$ 5,43), on/off-ramp, notificação, simulador de pagamento
- [x] `POST /api/quote` — preview BRL↔USDC
- [x] `POST /api/deposit/create` — cria tx `pending`, chama 4P, retorna PIX copia-e-cola
- [x] `GET /api/transactions/[id]` — detalhes da tx (autorizado por privy user)
- [x] `POST /api/webhooks/4p` — ack rápido, sync async, IP whitelist no modo real
- [x] `POST /api/mock/4p-pay` — simula pagamento (só mock)
- [x] `GET /api/cron/reconcile-4p` — busca txs `pending/processing` e sincroniza
- [x] Helper `reconcile.ts` idempotente (UNIQUE em `transaction_events.notification_token`)
- [x] Página `/app/deposit`: input BRL + quote live + QR Code + copy + polling + botão "Simular pagamento"
- [x] `pnpm typecheck` passando

### [EM ANDAMENTO] Sprint 3 — Kamino Lending
Documento: [docs/sprints/sprint-3-kamino.md](docs/sprints/sprint-3-kamino.md)
- [x] Driver Kamino abstraído multi-ambiente: `mock | staging | devnet | mainnet`
- [x] Config com presets por env (programId, mainMarket, cluster, explorer)
- [x] Mock driver in-memory com APY 6.25% acumulando em tempo real
- [x] Auto-deposit no Kamino quando on-ramp vira `paid`
- [x] `/api/balance` retorna posição on-chain (via driver) + BRL + APY
- [x] `/api/kamino/prepare-deposit` — retorna tx serializada para client signar
- [x] `/api/kamino/confirm-deposit` — client envia signature confirmada
- [x] `/api/kamino/config` — expõe config atual (env/cluster/explorer)
- [x] Dashboard exibe rendimento acumulado em BRL + APY real
- [x] `@solana/kit@2.3.0` alinhado com klend-sdk v7
- [x] Real driver: `getCurrentApy` + `getPosition` on-chain (staging/devnet/mainnet)
- [x] `prepareDeposit` / `prepareWithdraw` — `createNoopSigner` + `KaminoAction.buildDepositTxns/buildWithdrawTxns` + compile v0 tx + base64
- [x] `confirmDeposit` / `confirmWithdraw` validam signature via `getSignatureStatuses`
- [x] `/api/kamino/{prepare,confirm}-{deposit,withdraw}` endpoints
- [x] Hook `useKaminoSigning` — pede tx ao backend, assina via Privy `useSendTransaction`, confirma
- [x] Dashboard/deposit mostra botão "Aplicar no Kamino" após on-ramp paid (quando KAMINO_ENV != mock)
- [x] **Refinamentos v2:**
  - [x] Lookup tables via `compressTransactionMessageUsingAddressLookupTables` + `fetchAddressesForLookupTables`
  - [x] Extração de ALTs da `KaminoAction` com fallbacks (`preLoadedAddressLookupTables` etc)
  - [x] Preflight check: SOL balance + USDC balance antes de preparar tx (erros claros em PT-BR)
  - [x] Endpoint `GET /api/kamino/preflight` expõe saldos
  - [x] Hooks `useKaminoConfig` + `useKaminoPreflight`
  - [x] Componente `<EnvBadge />` (mock/devnet/staging/mainnet) no header do dashboard e withdraw
  - [x] Componente `<PreflightBanner />` avisa sobre SOL/USDC faltando + link para faucet devnet
  - [x] `/app/withdraw` integrado com Kamino real: withdraw on-chain (assinatura Privy) antes do off-ramp
- [x] `pnpm typecheck` passando fim-a-fim

### [EXECUTADO] Sprint 4 — Dashboard + Yield (dia 2 tarde)
Documento: [docs/sprints/sprint-4-dashboard.md](docs/sprints/sprint-4-dashboard.md)
- [x] `GET /api/cron/daily-snapshot` — grava `daily_yield_snapshots` por user (auth CRON_SECRET)
- [x] `GET /api/yield` — calcula rendimento hoje/mês + série 30 dias (snapshots + ponto atual)
- [x] `GET /api/transactions` — histórico paginado
- [x] Componente `YieldChart` (Recharts AreaChart)
- [x] Dashboard revamp: saldo + gráfico + 3 cards (hoje/mês/APY) + histórico
- [x] Página `/app/history` com lista de transações e badges de status
- [x] Cron agendado no `vercel.json` (00:00 BRT) + botão manual no modo mock

### [EXECUTADO] Sprint 5 — Off-ramp + Polimento (dia 3)
Documento: [docs/sprints/sprint-5-offramp.md](docs/sprints/sprint-5-offramp.md)
- [x] `POST /api/withdraw/create` — valida saldo, withdraw Kamino, cria off-ramp 4P
- [x] Página `/app/withdraw`: input BRL, presets 25/50/100%, steps visuais, simulador
- [x] Estados: pending → processing → paid com StepRow visual
- [x] Validação de saldo insuficiente
- [x] `pnpm typecheck` passando fim-a-fim

## Decisões de arquitetura
- **Non-custodial com UX custodial**: Privy embedded wallet. App orquestra, nunca segura chave.
- **4P sobre BRLA/Jupiter**: 1 API resolve PIX→USDC direto em Solana, sem swap intermediário.
- **Kamino default**: maior TVL em Solana, SDK TypeScript maduro, docs claras.
- **Neon sobre RDS/Supabase**: serverless, branching de DB, free tier generoso, pluga em Vercel.
- **Drizzle sobre Prisma**: tipagem estrita, migrations SQL-first, menor overhead.

## Referências de documentação

- [docs/arquitetura/mvp-plan.md](docs/arquitetura/mvp-plan.md) — plano de alto nível detalhado
- [docs/integracoes/4p-finance.md](docs/integracoes/4p-finance.md) — integração completa 4P (on/off-ramp, webhook)
- [docs/integracoes/kamino-lending.md](docs/integracoes/kamino-lending.md) — integração Kamino Lend
- [docs/integracoes/privy-wallet.md](docs/integracoes/privy-wallet.md) — Privy embedded wallet Solana
- [docs/banco-de-dados/schema.md](docs/banco-de-dados/schema.md) — schema Postgres + Drizzle

### [EXECUTADO] Sprint Admin A1-A3+A5 — Painel Administrativo
Documento: a criar em `docs/sprints/sprint-admin.md`
- [x] Schema: coluna `role` em users (customer/admin/support), `disabled_at`, tabela `admin_actions` (audit trail)
- [x] Helper `requireRole` / `requireAdmin` + `logAdminAction`
- [x] Script CLI `pnpm admin:grant <email> [admin|support]`
- [x] Layout `/admin` com sidebar, role badge, guard por client hook `useAdminGuard`
- [x] Dashboard `/admin`: KPIs (TVL BRL/USDC, rendimento, APY médio ponderado, users, depósitos/saques 7d/30d, pending, falhas) + gráfico TVL 30d
- [x] `/admin/customers`: busca, filtro status, tabela com saldo, role, estado
- [x] `/admin/customers/[id]`: 360° (identidade, CPF mascarado, posição Kamino, transações, reconciliar manual, toggle role, disable/enable)
- [x] `/admin/transactions`: listagem global com filtros status/kind/query + ação reconciliar
- [x] APIs: `/api/admin/metrics`, `/tvl-series`, `/customers`, `/customers/[id]`, `/customers/[id]/actions`, `/transactions`, `/transactions/[id]/reconcile`
- [x] Dashboard do user mostra card "Painel administrativo" se role = admin/support
- [x] `pnpm typecheck` passando

### [EXECUTADO] Sprint Admin A4 — Allocation Manager (Kamino multi-target)
- [x] Tabelas `allocation_strategies` + `allocation_targets` (kind, pubkey, weight_bps)
- [x] Helper `loadActiveAllocation()` + `splitAmount()` + `defaultFallbackTarget()`
- [x] `GET /api/admin/kamino/reserves` — hardcoded lista em mock, klend-sdk em staging/mainnet
- [x] `GET /api/admin/strategies` — lista com targets
- [x] `POST /api/admin/strategies` — cria (valida soma=10000bps)
- [x] `POST /api/admin/strategies/[id]/activate` — desativa as outras e ativa esta
- [x] `GET /api/admin/strategies/current` — retorna estratégia ativa ou fallback default
- [x] Página `/admin/strategies`: lista, ativação, modal de criação com sliders de peso e cálculo total em tempo real
- [x] `depositToKamino` lê estratégia ativa, splita o valor por weight e chama `kamino.deposit` por target; grava breakdown em `transaction_events`
- [x] `KaminoDriver.deposit/withdraw` aceita opts `{targetPubkey, targetMint, targetLabel}`
- [x] Fallback automático pra Main Market quando não há estratégia ativa
- [x] **Real driver multi-reserve**: `resolveReserve({targetMint})` escolhe o reserve correto (USDC/USDT/PYUSD/SOL/etc) baseado no mint passado via allocation
- [x] **`getPreflight` aceita mint opcional**: checa saldo do token específico do target (ex: USDT em vez de USDC)
- [x] **`/api/admin/kamino/vaults` staging/mainnet**: tenta `kliquidity-sdk` (`Kamino.getStrategiesWithAddresses`), fallback para lista curada de vaults conhecidos mainnet
- [x] `/api/kamino/preflight?mint=<mint>` aceita mint específico via query
- [x] `next.config.mjs` — adicionado `kvault-sdk` e `kliquidity-sdk` aos external packages

### [PLANEJADO] Sprint Admin A6 — Chat de suporte
- [ ] Chatwoot self-hosted + widget embed em `/app`
- [ ] Webhook bidirecional correlacionando conversa ↔ user_id
- [ ] Botão "abrir conversa" no detalhe do cliente

### [EXECUTADO] Sprint Admin A7 — Finance admin
- [x] Tabelas `fee_config` (singleton por data) + `fees_collected` (por tx)
- [x] Helper `computeOnrampFees` / `computeOfframpFees` / `recordFees` / `loadFeeConfig`
- [x] `GET/POST /api/admin/finance/config` — config de fees (admin only)
- [x] `GET /api/admin/finance/revenue` — totais, por tipo, série diária 30d
- [x] `/api/deposit/create` aplica fee, debita do valor convertido, grava `fees_collected`
- [x] `/api/withdraw/create` aplica fee, grava `fees_collected`
- [x] Validação de valor mínimo (depósito/saque) via `min_deposit_brl` / `min_withdraw_brl`
- [x] Página `/admin/finance`: 4 KPIs (total, mês, 7d, 30d) + gráfico 30d + breakdown por tipo + form de config (fees fixos/% e mínimos)
- [x] Cron daily-snapshot aplica performance fee: calcula yield desde último snapshot, cobra `performancePercentBps`, grava em `fees_collected` + debita posição via `kamino.adjustPosition()`
- [x] `KaminoDriver.adjustPosition()` no mock permite debitar fees diretamente do saldo in-memory

## Pendências bloqueantes
- [ ] Confirmar com 4P: ativação da API Key com par **Solana + USDC**
- [ ] Confirmar taxas on/off-ramp
- [ ] Confirmar limites min/max por transação
- [ ] Obter ambiente de teste ou autorização pra testar em prod com valores mínimos
- [ ] Whitelist IP `44.196.63.157` no webhook
