# Sprint 5 — Off-ramp + Polimento (dia 3)

**Objetivo**: saque funcional e app pronto pra demo.

## Entregáveis
- [ ] Tela `/app/withdraw`: input valor, preview, confirmação
- [ ] Fluxo: withdraw Kamino → criar off-ramp 4P → assinar tx USDC → PIX recebido
- [ ] Webhook off-ramp fecha ciclo
- [ ] Estados de erro claros em cada passo
- [ ] Loading states bonitos
- [ ] Confetti/feedback positivo ao completar
- [ ] README no repo com pitch + como rodar
- [ ] Vídeo de demo gravado (opcional mas +1 pontos)

## Fluxo saque

```
1. /api/withdraw/create { amountBRL }
   ├─ quote BRL→USDC
   ├─ kamino.prepareWithdraw(usdc) → ixs
   └─ retorna txSerialized pro client

2. Client assina withdraw Kamino via Privy → confirma on-chain
3. /api/withdraw/offramp { withdrawSig, amountUSDC }
   ├─ valida withdraw on-chain
   ├─ 4P.cryptopix/transaction com destination_pix_key do user
   ├─ retorna { receiverWallet (da 4P), txidOffRamp }

4. Client: prepara transfer USDC → receiverWallet (da 4P), assina, envia
5. /api/withdraw/submit { sig } marca transaction status=processing

6. 4P webhook: USDC confirmado → PIX enviado → webhook status=paid
7. UI exibe "PIX enviado pra sua conta ✓"
```

## Tratamento de erros por passo
- **Withdraw Kamino falhou**: nada perdido, user tenta de novo
- **Off-ramp 4P falhou**: USDC na wallet do user, sugerir retry ou deposit de volta no Kamino
- **Transfer USDC → 4P falhou**: refazer, tx serialized reutilizável até expirar
- **PIX não chegou**: exibir status "processando", dar contato 4P como fallback

## Polimento UI
- Estados vazios (sem depósitos ainda) com ilustração + CTA
- Skeleton loaders no dashboard
- Toast notifications (sonner)
- Dark mode
- Animações sutis (framer-motion)

## README
```markdown
# PoupApp
Poupança DeFi em dólar. Deposite BRL via PIX, rendimento em USDC via Kamino, saque via PIX.

## Demo
[link vídeo]

## Como rodar
1. `cp .env.example .env` e preencher
2. `pnpm i`
3. `pnpm drizzle-kit push`
4. `pnpm dev`

## Stack
Next.js 14 • Privy • 4P Finance • Kamino • Neon • Drizzle • Solana
```

## Pitch (3min)
1. Problema: poupança BR rende <CDI, e 90% dos brasileiros não sabem/podem investir em dólar
2. Solução: app tão fácil quanto caixinha Nubank, mas em dólar stablecoin com yield real
3. Demo ao vivo: cadastro → PIX → ver saldo rendendo → saque → PIX recebido
4. Arquitetura em 1 slide
5. Próximos passos: múltiplas caixinhas, metas, diversificação de protocolos

## Critério de pronto
- Depósito + saque funcionam de ponta a ponta em prod
- Demo roda sem bugs em 3 min
- README claro e vídeo gravado
