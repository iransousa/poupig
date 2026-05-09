# Sprint 1 — Onboarding + Wallet (dia 1 manhã)

**Objetivo**: usuário consegue logar, ver wallet Solana criada, e completar KYC leve (CPF + chave PIX).

## Entregáveis
- [ ] Landing page com CTA "Começar"
- [ ] Login Privy (email/Google)
- [ ] Criação automática de embedded Solana wallet
- [ ] Tela de onboarding: nome, CPF, chave PIX
- [ ] Validação CPF (algoritmo de dígitos)
- [ ] Validação chave PIX (formato)
- [ ] Persistência em `users` (Neon, CPF/PIX criptografados)
- [ ] Redirect `/app` após onboarding
- [ ] Middleware: rotas `/app/*` protegidas; rotas `/api/*` validam JWT Privy

## Rotas
- `/` landing
- `/login` (handled by Privy modal)
- `/onboarding` form
- `/app` dashboard (placeholder)

## API routes
- `POST /api/users/register` — cria user após form
  - Valida CPF com algoritmo
  - Criptografa CPF e PIX
  - Insere em `users`
  - Retorna 201

- `GET /api/users/me` — retorna dados do user logado

## UI
- Logo + hero "Sua poupança em dólar, sem esforço"
- Botão "Entrar" abre modal Privy
- Pós-login: se `onboarded_at IS NULL` → `/onboarding`; senão → `/app`
- Form onboarding: 3 campos, estado de loading, erros inline

## Critério de pronto
- User novo: landing → login → onboarding → `/app`
- User existente: landing → login → `/app` direto
- Row em `users` com CPF criptografado
- `solana_wallet_address` preenchido automaticamente pós-login
