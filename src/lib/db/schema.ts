import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  date,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    privyUserId: text('privy_user_id').notNull().unique(),
    email: text('email').unique(),
    phone: text('phone'),
    fullName: text('full_name'),
    role: text('role', { enum: ['customer', 'admin', 'support'] })
      .notNull()
      .default('customer'),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    cpfEncrypted: text('cpf_encrypted'),
    pixKeyEncrypted: text('pix_key_encrypted'),
    solanaWalletAddress: text('solana_wallet_address').unique(),
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    walletIdx: index('users_wallet_idx').on(t.solanaWalletAddress),
  }),
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['onramp', 'offramp'] }).notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'paid', 'error', 'expired'],
    })
      .notNull()
      .default('pending'),
    amountBrl: numeric('amount_brl', { precision: 18, scale: 2 }),
    amountUsdc: numeric('amount_usdc', { precision: 18, scale: 6 }),
    fourPTxid: text('four_p_txid'),
    fourPToken: text('four_p_token').unique(),
    fourPNotificationToken: text('four_p_notification_token'),
    pixCopiaECola: text('pix_copia_e_cola'),
    pixQrChave: text('pix_qr_chave'),
    receiverWallet: text('receiver_wallet'),
    destinationPixKey: text('destination_pix_key'),
    solanaSignature: text('solana_signature'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('transactions_user_idx').on(t.userId, t.createdAt),
    statusIdx: index('transactions_status_idx').on(t.status),
  }),
);

export const transactionEvents = pgTable(
  'transaction_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    previousStatus: text('previous_status'),
    newStatus: text('new_status'),
    payload: jsonb('payload'),
    notificationToken: text('notification_token').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    txIdx: index('transaction_events_tx_idx').on(t.transactionId),
  }),
);

export const kaminoPositions = pgTable('kamino_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  marketPubkey: text('market_pubkey').notNull(),
  obligationPubkey: text('obligation_pubkey'),
  usdcSupplied: numeric('usdc_supplied', { precision: 18, scale: 6 }).notNull().default('0'),
  usdcCurrentValue: numeric('usdc_current_value', { precision: 18, scale: 6 })
    .notNull()
    .default('0'),
  currentApy: numeric('current_apy', { precision: 8, scale: 4 }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dailyYieldSnapshots = pgTable(
  'daily_yield_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    snapshotDate: date('snapshot_date').notNull(),
    usdcSupplied: numeric('usdc_supplied', { precision: 18, scale: 6 }).notNull(),
    usdcCurrentValue: numeric('usdc_current_value', { precision: 18, scale: 6 }).notNull(),
    apy: numeric('apy', { precision: 8, scale: 4 }),
    brlQuote: numeric('brl_quote', { precision: 18, scale: 2 }).notNull(),
    usdcBrlRate: numeric('usdc_brl_rate', { precision: 18, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('daily_yield_user_date_uq').on(t.userId, t.snapshotDate),
    userDateIdx: index('daily_yield_user_date_idx').on(t.userId, t.snapshotDate),
  }),
);

export const webhookRetries = pgTable('webhook_retries', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  notificationToken: text('notification_token').notNull(),
  attempts: integer('attempts').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }).notNull().defaultNow(),
  lastError: text('last_error'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const allocationStrategies = pgTable(
  'allocation_strategies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    active: timestamp('active_since', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('allocation_strategies_active_idx').on(t.active),
  }),
);

export const allocationTargets = pgTable(
  'allocation_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyId: uuid('strategy_id')
      .notNull()
      .references(() => allocationStrategies.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['reserve', 'vault'] }).notNull(),
    label: text('label').notNull(),
    marketPubkey: text('market_pubkey').notNull(),
    targetPubkey: text('target_pubkey').notNull(),
    mintPubkey: text('mint_pubkey').notNull(),
    symbol: text('symbol').notNull().default('USDC'),
    weightBps: integer('weight_bps').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    strategyIdx: index('allocation_targets_strategy_idx').on(t.strategyId),
  }),
);

export const feeConfig = pgTable('fee_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  onrampFixedBrl: numeric('onramp_fixed_brl', { precision: 10, scale: 2 }).notNull().default('0'),
  onrampPercentBps: integer('onramp_percent_bps').notNull().default(0),
  offrampFixedBrl: numeric('offramp_fixed_brl', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  offrampPercentBps: integer('offramp_percent_bps').notNull().default(0),
  performancePercentBps: integer('performance_percent_bps').notNull().default(0),
  minDepositBrl: numeric('min_deposit_brl', { precision: 10, scale: 2 }).notNull().default('1'),
  minWithdrawBrl: numeric('min_withdraw_brl', { precision: 10, scale: 2 }).notNull().default('1'),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const feesCollected = pgTable(
  'fees_collected',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind', {
      enum: ['onramp_fixed', 'onramp_percent', 'offramp_fixed', 'offramp_percent', 'performance'],
    }).notNull(),
    amountBrl: numeric('amount_brl', { precision: 18, scale: 2 }),
    amountUsdc: numeric('amount_usdc', { precision: 18, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('fees_collected_user_idx').on(t.userId, t.createdAt),
    kindIdx: index('fees_collected_kind_idx').on(t.kind, t.createdAt),
  }),
);

export const adminActions = pgTable(
  'admin_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index('admin_actions_actor_idx').on(t.actorId, t.createdAt),
    targetIdx: index('admin_actions_target_idx').on(t.targetUserId, t.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type AdminAction = typeof adminActions.$inferSelect;
export type AllocationStrategy = typeof allocationStrategies.$inferSelect;
export type AllocationTarget = typeof allocationTargets.$inferSelect;
export type FeeConfig = typeof feeConfig.$inferSelect;
export type FeeCollected = typeof feesCollected.$inferSelect;
