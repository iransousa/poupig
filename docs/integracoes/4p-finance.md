# Integração 4P Finance

Documentação oficial: https://docs.4p.finance/

## Ativação da API Key
Na solicitação da API Key, informar explicitamente ao suporte 4P:
- **Rede**: Solana
- **Moeda**: USDC

Sem essa ativação, a chave não processa USDC-Solana.

## Autenticação
- Header: `x-api-key: <FOUR_P_API_KEY>`
- **Backend-only**. Nunca expor em frontend.
- Variável de ambiente: `FOUR_P_API_KEY`

## Endpoints usados

### 1. Cotação — `POST /v1/transaction/price_conversion`
**Uso**: preview "R$ 100 = Y USDC" antes do user confirmar.

Request:
```json
{
  "amount": "100.00",
  "currency_from_symbol": "BRL",
  "convert": "USDC"
}
```

### 2. On-ramp — `PUT /v1/pix/transaction`
**Uso**: criar cobrança PIX que entrega USDC direto na wallet Solana do user.

Request:
```json
{
  "cpf": "01234567899",
  "email": "usuario@example.com",
  "amount": 100.00,
  "expires": 3600,
  "custom_id": "<uuid_interno>",
  "custom_data": {
    "receiver_wallet": "<pubkey_solana_user>"
  },
  "description": "Depósito PoupApp",
  "notification_url": "https://api.poupapp.com/api/webhooks/4p?token=<uuid_webhook>"
}
```

Response chave:
- `txid` — ID da 4P
- `pixCopiaECola` — string copia-e-cola
- `chave` — chave PIX pra gerar QR
- `status: "ATIVA"`

**Validação**:
- `amount >= 0.01`
- `expires` entre 300 e 259200 segundos
- `custom_id <= 255 chars` e **único**
- `description <= 140 chars`

### 3. Off-ramp — `PUT /v1/cryptopix/transaction`
**Uso**: converter USDC do user em BRL e pagar na chave PIX.

Request:
```json
{
  "person_document": "01234567899",
  "email": "usuario@example.com",
  "amount_crypto": 18.42,
  "custom_id": "<uuid_interno>",
  "custom_data": { "asset": "USDC", "chain": "Solana" },
  "sender_wallet": "<pubkey_solana_user>",
  "destination_pix_key": "<chave_pix_user>",
  "notification_url": "https://api.poupapp.com/api/webhooks/4p?token=<uuid>"
}
```

Response chave:
- `txid`
- `receiver_wallet` — **endereço Solana da 4P pra onde o user deve enviar USDC**
- `amount_brl` — valor que será pago via PIX
- `expires` — timestamp Unix

### 4. Notificação — `GET /v1/notification/:token`
**Uso**: buscar dados completos após receber POST do webhook.

Response on-ramp:
```json
{
  "status": "paid",
  "amount": "100.00",
  "custom_id": "...",
  "payer_info": "Nome - CPF",
  "payment_date_time": "...",
  "confirmed_at": "..."
}
```

Response off-ramp (inclui dados on-chain):
```json
{
  "status": "paid",
  "custom_data": {
    "chain_name": "Solana",
    "amount_usdt": "18.42",
    "receiver_wallet": "...",
    "transaction_hash": "<solana_sig>"
  }
}
```

## Webhook: fluxo two-way

```
4P ──POST {token}──▶ nosso endpoint
                      │
                      ├─ valida IP 44.196.63.157
                      ├─ valida token em DB
                      ├─ responde 200 rapidamente
                      └─ (async) GET /notification/:token ──▶ 4P
                                                              │
                                       ◀────── payload completo
```

**Regras críticas:**
- Se **não consumirmos o GET em 5 dias**, 4P reenviará.
- Cron de reconciliação a cada 5min: busca transações `pending` e faz GET manual.
- `notification_url` precisa de HTTPS.
- Implementar idempotência: `token` único → `transaction_events.notification_token UNIQUE`.

## Estados da transação (espelhados no DB)
- `pending` — criada, aguardando pagamento/envio
- `processing` — pagamento/envio confirmado, conversão em andamento
- `paid` — completa (sucesso)
- `error` — falhou (logar motivo, expor no histórico)
- `expired` — tempo esgotado sem pagamento

## Mapeamento de `custom_id`
Usamos UUID v4 gerado no backend = `transactions.id` interno. Facilita lookup bidirecional.

## Limites e taxas
**TODO**: obter com a 4P antes do lançamento.
- Mínimo por transação?
- Máximo por transação?
- Limite diário por CPF?
- Taxa on-ramp (% ou fixo)?
- Taxa off-ramp (% ou fixo)?

## Configuração de rede (infra)
- Whitelist inbound: IP `44.196.63.157` no Vercel/Cloudflare WAF
- Rate limiting no endpoint `/api/webhooks/4p`: 100 req/min por IP
- Logs estruturados com `token`, `txid`, `custom_id` pra rastreio

## Tratamento de erros 4P
- `409` — `custom_id` duplicado → bug nosso, logar e alertar
- `400` — payload inválido → validar com Zod antes de mandar
- `401` — API key inválida → alerta imediato
- `5xx` — retry com backoff exponencial (max 3 tentativas)

## Checklist de integração
- [ ] API Key ativada com par Solana+USDC
- [ ] `FOUR_P_API_KEY` em env var
- [ ] IP `44.196.63.157` em whitelist
- [ ] Endpoint `/api/webhooks/4p` implementado
- [ ] Cron de reconciliação rodando
- [ ] Logs estruturados (token, custom_id, status)
- [ ] Testes com valores mínimos (R$ 0,01) em prod
