import type {
  FourPDriver,
  FourPResponse,
  NotificationData,
  NotificationStatus,
  OffRampCreatedData,
  OffRampInput,
  OnRampCreatedData,
  OnRampInput,
  PriceConversionData,
  QuoteInput,
} from './types';

const MOCK_BRL_PER_USDC = 5.43;
const MOCK_4P_WALLET = 'MockP4YSo1anaWa11etAddre55xxxxxxxxxxxxxxxxxxx';

type MockRecord = {
  token: string;
  txid: string;
  customId: string;
  kind: 'onramp' | 'offramp';
  amountBRL: number;
  amountUSDC: number;
  status: NotificationStatus;
  receiverWallet: string;
  createdAt: number;
  paidAt?: number;
  payerInfo?: string;
  solanaSignature?: string;
};

type MockGlobal = {
  store: Map<string, MockRecord>;
  customIdIndex: Map<string, string>;
};

const g = globalThis as unknown as { __poupappMock4P?: MockGlobal };
if (!g.__poupappMock4P) {
  g.__poupappMock4P = { store: new Map(), customIdIndex: new Map() };
}
const STORE = g.__poupappMock4P.store;
const CUSTOM_ID_INDEX = g.__poupappMock4P.customIdIndex;

function ok<T>(data: T, result = 'ok'): FourPResponse<T> {
  return { http_code: 200, success: true, info: { result, message: 'ok', data } };
}

function randomTxid() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function parseNotificationUrlToken(url: string): string | null {
  try {
    return new URL(url).searchParams.get('token');
  } catch {
    return null;
  }
}

function buildPixCopiaECola(amount: number, customId: string) {
  return (
    '00020126430014br.gov.bcb.pix0114mock-poupapp-4p' +
    `52040000530398654${amount.toFixed(2).padStart(10, '0')}` +
    `5802BR5909PoupApp6008Brasilia62${customId.length.toString().padStart(2, '0')}${customId}6304MOCK`
  );
}

export const mockDriver: FourPDriver = {
  async priceConversion(input: QuoteInput) {
    const amount = Number(input.amount);
    let converted: number;
    if (input.from === 'BRL' && input.to === 'USDC') converted = amount / MOCK_BRL_PER_USDC;
    else if (input.from === 'USDC' && input.to === 'BRL') converted = amount * MOCK_BRL_PER_USDC;
    else converted = amount;
    const data: PriceConversionData = {
      symbol: input.to,
      amount: converted.toFixed(6),
      quote: { price: MOCK_BRL_PER_USDC.toString(), timestamp: new Date().toISOString() },
    };
    return ok(data, 'price_converted');
  },

  async createPixOnRamp(input: OnRampInput) {
    const token = parseNotificationUrlToken(input.notificationUrl) ?? `tok_${randomTxid()}`;
    const txid = randomTxid();
    const usdc = input.amountBRL / MOCK_BRL_PER_USDC;
    const rec: MockRecord = {
      token,
      txid,
      customId: input.customId,
      kind: 'onramp',
      amountBRL: input.amountBRL,
      amountUSDC: usdc,
      status: 'pending',
      receiverWallet: input.receiverWallet,
      createdAt: Date.now(),
    };
    STORE.set(token, rec);
    CUSTOM_ID_INDEX.set(input.customId, token);
    const data: OnRampCreatedData = {
      txid,
      status: 'ATIVA',
      pixCopiaECola: buildPixCopiaECola(input.amountBRL, input.customId.slice(0, 20)),
      chave: `mock-${token}`,
      valor: { original: input.amountBRL },
    };
    return ok(data, 'pix_transaction_created');
  },

  async createPixOffRamp(input: OffRampInput) {
    const token = parseNotificationUrlToken(input.notificationUrl) ?? `tok_${randomTxid()}`;
    const txid = randomTxid();
    const brl = input.amountUSDC * MOCK_BRL_PER_USDC;
    const rec: MockRecord = {
      token,
      txid,
      customId: input.customId,
      kind: 'offramp',
      amountBRL: brl,
      amountUSDC: input.amountUSDC,
      status: 'pending',
      receiverWallet: MOCK_4P_WALLET,
      createdAt: Date.now(),
    };
    STORE.set(token, rec);
    CUSTOM_ID_INDEX.set(input.customId, token);
    const data: OffRampCreatedData = {
      txid,
      amount_crypto: input.amountUSDC,
      asset: 'USDC',
      chain: 'Solana',
      amount_brl: Number(brl.toFixed(2)),
      receiver_wallet: MOCK_4P_WALLET,
      expires: Math.floor(Date.now() / 1000) + 3600,
    };
    return ok(data, 'p2p_transaction_cryptopix_created');
  },

  async getNotification(token: string) {
    const rec = STORE.get(token);
    if (!rec) {
      return {
        http_code: 404,
        success: false,
        info: { result: 'not_found', message: 'Token not found', data: null as unknown as NotificationData },
      };
    }
    const data: NotificationData = {
      id: rec.token,
      txid: rec.txid,
      status: rec.status,
      amount: rec.amountBRL.toFixed(2),
      custom_id: rec.customId,
      payer_info: rec.payerInfo ?? 'Mock User - 000.000.000-00',
      payment_date_time: rec.paidAt ? new Date(rec.paidAt).toISOString() : undefined,
      confirmed_at: rec.paidAt ? new Date(rec.paidAt).toISOString() : undefined,
      custom_data:
        rec.kind === 'offramp'
          ? {
              chain_name: 'Solana',
              amount_usdt: rec.amountUSDC.toString(),
              receiver_wallet: rec.receiverWallet,
              transaction_hash: rec.solanaSignature,
            }
          : undefined,
    };
    return ok(data, 'notification_found');
  },
};

export function mockMarkPaid(tokenOrCustomId: string): MockRecord | null {
  const token = STORE.has(tokenOrCustomId)
    ? tokenOrCustomId
    : CUSTOM_ID_INDEX.get(tokenOrCustomId);
  if (!token) return null;
  const rec = STORE.get(token);
  if (!rec) return null;
  rec.status = 'paid';
  rec.paidAt = Date.now();
  return rec;
}

export function mockGetRecord(customId: string) {
  const token = CUSTOM_ID_INDEX.get(customId);
  if (!token) return null;
  return STORE.get(token) ?? null;
}
