# Sprint 0 — Setup (dia 0)

**Objetivo**: projeto rodando localmente com stack base e DB conectado. Nada funcional ainda.

## Entregáveis
- [ ] Repo Next.js 14 (App Router) + TypeScript + ESLint + Prettier
- [ ] Tailwind + shadcn/ui instalados
- [ ] Privy SDK configurado (client + server)
- [ ] Drizzle + Neon conectado
- [ ] Primeira migration rodando
- [ ] Deploy Vercel preview funcionando
- [ ] Env vars documentadas em `.env.example`

## Estrutura de pastas
```
src/
  app/
    (public)/          # landing, login
    (app)/             # rotas autenticadas (layout com guard Privy)
      layout.tsx
      page.tsx
      deposit/
      withdraw/
      history/
    api/
      auth/
      quote/
      deposit/
      withdraw/
      webhooks/
      kamino/
      balance/
      yield/
      cron/
  components/
    ui/                # shadcn
    app/               # app-specific
  lib/
    db/                # drizzle schema + client
      schema.ts
      client.ts
    four-p/            # cliente 4P
    kamino/            # cliente Kamino
    privy/             # server helpers
    solana/            # connection + helpers
    crypto/            # criptografia CPF/PIX
  drizzle/             # migrations
  env.ts               # validação env (zod)
```

## Env vars (.env.example)
```
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Privy
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=

# Neon
DATABASE_URL=postgres://...

# Criptografia
DB_ENCRYPTION_KEY=

# 4P
FOUR_P_API_KEY=
FOUR_P_API_BASE=https://api.4p.finance
FOUR_P_WEBHOOK_IP_ALLOWLIST=44.196.63.157

# Solana
SOLANA_RPC_URL=
KAMINO_MARKET_PUBKEY=
```

## Setup passo a passo
```bash
pnpm create next-app@latest poupapp --ts --app --tailwind --eslint
cd poupapp

# shadcn
pnpm dlx shadcn@latest init

# Privy
pnpm add @privy-io/react-auth @privy-io/server-auth

# DB
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit

# Solana + Kamino
pnpm add @solana/web3.js @kamino-finance/klend-sdk bn.js

# Utils
pnpm add zod @tanstack/react-query date-fns
```

## Critério de pronto
- `pnpm dev` abre em localhost:3000
- Login Privy funciona (cria wallet Solana)
- `pnpm drizzle-kit push` aplica schema inicial em Neon
- Preview deploy Vercel acessível
