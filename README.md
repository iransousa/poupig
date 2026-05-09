# PoupApp

Poupança DeFi em dólar para brasileiros. Deposite em BRL via PIX, o app converte pra USDC na Solana e aplica automaticamente em protocolos de lending (Kamino). Saque via PIX quando quiser.

## Stack
Next.js 14 · TypeScript · Privy (embedded Solana wallet) · 4P Finance (PIX↔USDC) · Kamino Lend · Neon Postgres · Drizzle ORM · Vercel

## Como rodar

```bash
cp .env.example .env
# preencher as variáveis

pnpm install
pnpm db:push      # aplica schema no Neon
pnpm dev
```

## Estrutura
Ver [CLAUDE.md](./CLAUDE.md) para o planejamento e [docs/](./docs/) para detalhes de cada integração.

## Status
- Sprint 0 (setup) — **EXECUTADO**
- Sprint 1 (onboarding) — **EXECUTADO**
- Sprint 2 (on-ramp mock) — **EXECUTADO**
- Sprint 3 (Kamino mock) — **EXECUTADO** · real driver devnet = próximo
- Sprint 4 (dashboard + yield) — **EXECUTADO**
- Sprint 5 (off-ramp + polimento) — **EXECUTADO**
- **Próximo: Kamino devnet real** (`@solana/kit` + klend-sdk v7)
