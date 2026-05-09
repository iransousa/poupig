# Schema do Banco — Neon + Drizzle

DB: Neon (Postgres 16)
ORM: Drizzle
Migrations: `drizzle-kit`

## Tabelas

### users
Dados do usuário, espelho mínimo do Privy + KYC leve.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | gerado no app |
| privy_user_id | text UNIQUE | id retornado pelo Privy |
| email | text UNIQUE | |
| full_name | text | |
| cpf_encrypted | text | criptografado (pgcrypto) |
| pix_key_encrypted | text | chave PIX pra saques |
| solana_wallet_address | text UNIQUE | pubkey do embedded wallet |
| onboarded_at | timestamptz NULL | null = não completou onboarding |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | |

### transactions
Registro central de toda operação PIX↔USDC (on e off-ramp).

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | = `custom_id` enviado à 4P |
| user_id | uuid FK users | |
| kind | text | `onramp` \| `offramp` |
| status | text | `pending`, `processing`, `paid`, `error`, `expired` |
| amount_brl | numeric(18,2) | |
| amount_usdc | numeric(18,6) | preenchido após conversão |
| four_p_txid | text | id retornado pela 4P |
| four_p_token | text | token do webhook (único) |
| pix_copia_e_cola | text | on-ramp apenas |
| pix_qr_chave | text | on-ramp apenas |
| receiver_wallet | text | on-ramp: wallet user / off-ramp: wallet 4P |
| destination_pix_key | text | off-ramp apenas |
| solana_signature | text | tx hash Solana (off-ramp) |
| error_message | text NULL | |
| created_at | timestamptz | |
| expires_at | timestamptz | |
| confirmed_at | timestamptz NULL | |

Índices:
- `(user_id, created_at DESC)` — listar histórico
- `(status)` — cron de reconciliação
- `four_p_token` UNIQUE — idempotência

### transaction_events
Audit trail. Toda mudança de status + payload bruto da 4P.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| transaction_id | uuid FK | |
| event_type | text | `created`, `webhook_received`, `status_changed`, `error`, `kamino_deposit`, `kamino_withdraw` |
| previous_status | text NULL | |
| new_status | text NULL | |
| payload | jsonb | resposta completa da 4P ou dados on-chain |
| notification_token | text NULL UNIQUE | pra deduplicar webhooks |
| created_at | timestamptz | |

### kamino_positions
Espelho da posição de lending. Fonte de verdade é on-chain, mas mantemos cache pra dashboard rápido.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK UNIQUE | 1 user = 1 obligation (MVP) |
| market_pubkey | text | main market Kamino |
| obligation_pubkey | text | |
| usdc_supplied | numeric(18,6) | principal depositado |
| usdc_current_value | numeric(18,6) | principal + yield (última leitura) |
| current_apy | numeric(8,4) | ex: 5.24 = 5.24% |
| last_synced_at | timestamptz | |
| created_at | timestamptz | |

### daily_yield_snapshots
Snapshot diário pra calcular rendimento e gráfico.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | |
| snapshot_date | date | data (BRT) |
| usdc_supplied | numeric(18,6) | principal acumulado até a data |
| usdc_current_value | numeric(18,6) | valor c/ yield |
| apy | numeric(8,4) | APY no snapshot |
| brl_quote | numeric(18,2) | valor em BRL naquele dia |
| usdc_brl_rate | numeric(18,6) | cotação USDC→BRL do dia |
| created_at | timestamptz | |

Unique: `(user_id, snapshot_date)`.
Índice: `(user_id, snapshot_date DESC)`.

### webhook_retries
Fila lógica de reconciliação de webhooks 4P.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| transaction_id | uuid FK | |
| notification_token | text | |
| attempts | int | default 0 |
| next_retry_at | timestamptz | |
| last_error | text NULL | |
| resolved_at | timestamptz NULL | |

Cron a cada 5 min processa `WHERE resolved_at IS NULL AND next_retry_at <= now()`.

## Migrations
```
drizzle/
  0000_initial.sql         # users + transactions + events
  0001_kamino.sql          # kamino_positions
  0002_yield.sql           # daily_yield_snapshots
  0003_webhook_retries.sql # webhook_retries
```

## Criptografia de dados sensíveis
CPF e chave PIX criptografados com `pgcrypto`:
```sql
-- insert
INSERT INTO users (cpf_encrypted) VALUES (pgp_sym_encrypt('12345678900', :secret));
-- select
SELECT pgp_sym_decrypt(cpf_encrypted::bytea, :secret) AS cpf FROM users;
```
Segredo em `DB_ENCRYPTION_KEY` (env var, nunca no código).

## Backup/branching
- Neon faz snapshot automático diário
- Cada PR cria branch DB (ambientes de preview isolados)
- Produção: `main` branch

## Performance
- Connection pooling Neon via `@neondatabase/serverless` driver (HTTP pool)
- Drizzle em modo HTTP pra rotas serverless Vercel
- Índices listados por tabela acima cobrem queries do dashboard e cron
