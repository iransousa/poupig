# Integração Privy (Auth + Embedded Wallet)

Docs: https://docs.privy.io/
SDKs: `@privy-io/react-auth`, `@privy-io/server-auth`

## Por que Privy
- Login social/email sem seed phrase
- **Embedded wallet Solana** nativa
- Chave privada nunca no nosso servidor
- Fee sponsoring (paga gas pelo user)
- JWT verificável no backend
- Free tier generoso pra hackathon

## Configuração
Env vars:
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `PRIVY_APP_SECRET` (backend)
- Configuração no dashboard Privy:
  - Login methods: email, Google, (opcional: SMS)
  - Solana embedded wallets: **habilitar criação automática**
  - Fee sponsoring em Solana: habilitar com saldo em SOL na app wallet

## Onboarding flow
```
1. User clica "Entrar"
2. Privy modal → login email/Google
3. Privy cria embedded Solana wallet (primeira vez)
4. App redireciona pra /onboarding
5. Form: nome completo, CPF, chave PIX
6. POST /api/users/register → salva em Neon
7. Privy JWT marcado como "onboarded"
```

## Autenticação no backend

```typescript
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(APP_ID, APP_SECRET);

// middleware
const token = req.headers.authorization?.replace('Bearer ', '');
const claims = await privy.verifyAuthToken(token);
const user = await privy.getUser(claims.userId);
const solanaWallet = user.linkedAccounts.find(a => a.type === 'wallet' && a.chainType === 'solana');
// solanaWallet.address = pubkey
```

Middleware Next.js rejeita rotas `/api/*` (exceto webhook 4P) sem JWT válido.

## Assinatura de transações (client-side)

```typescript
import { useSolanaWallets, useSendTransaction } from '@privy-io/react-auth/solana';

const { wallets } = useSolanaWallets();
const wallet = wallets[0];

const { sendTransaction } = useSendTransaction();

const signature = await sendTransaction({
  transaction,
  connection,
  address: wallet.address,
});
```

Backend **nunca** chama sign. Fluxo: backend prepara `VersionedTransaction` → envia serializada pro frontend → Privy assina → envia → retorna signature.

## Fee sponsoring
Habilitado no dashboard Privy. App mantém SOL numa wallet patrocinadora; Privy paga fees de tx automaticamente.

**Crítico pro MVP**: sem isso, user precisa ter SOL, o que quebra a promessa "cripto invisível".

## Dados armazenados no nosso DB
Só o necessário pra operar:
- `privy_user_id` (unique key)
- `email`
- `solana_wallet_address`
- `cpf` (criptografado)
- `pix_key` (criptografado)
- `full_name`

Não guardamos:
- Senha
- Seed phrase
- Chave privada

## Checklist
- [ ] App ID + Secret em env
- [ ] Solana embedded wallets habilitado no dashboard
- [ ] Fee sponsoring ativado + wallet patrocinadora com saldo
- [ ] Middleware de auth nas API routes
- [ ] Onboarding form com CPF + chave PIX
