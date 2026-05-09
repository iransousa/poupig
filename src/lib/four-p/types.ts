export type FourPResponse<T> = {
  http_code: number;
  success: boolean;
  // Após normalização em real-client.ts, `info` está sempre presente em sucessos.
  info: { result: string; message?: string; data: T };
  details?: { result: string; message?: string; data?: T };
};

export type PriceConversionData = {
  symbol: string;
  amount: string;
  quote: { price: string; timestamp: string };
};

export type OnRampCreatedData = {
  txid: string;
  status: string;
  pixCopiaECola: string;
  chave: string;
  valor: { original: number };
};

export type OffRampCreatedData = {
  txid: string;
  amount_crypto: number;
  asset: string;
  chain: string;
  amount_brl: number;
  receiver_wallet: string;
  expires: number;
};

export type NotificationStatus = 'pending' | 'processing' | 'paid' | 'error' | 'expired';

export type NotificationData = {
  id: string;
  txid: string;
  status: NotificationStatus;
  amount: string;
  custom_id: string;
  payer_info?: string;
  payment_date_time?: string;
  confirmed_at?: string;
  custom_data?: {
    chain_name?: string;
    amount_usdt?: string;
    receiver_wallet?: string;
    transaction_hash?: string;
  };
};

export type OnRampInput = {
  cpf: string;
  email: string;
  amountBRL: number;
  customId: string;
  receiverWallet: string;
  notificationUrl: string;
  description?: string;
  expires?: number;
};

export type OffRampInput = {
  cpf: string;
  email: string;
  amountUSDC: number;
  customId: string;
  senderWallet: string;
  destinationPixKey: string;
  notificationUrl: string;
};

export type QuoteInput = { amount: string; from: string; to: string };

export interface FourPDriver {
  priceConversion(input: QuoteInput): Promise<FourPResponse<PriceConversionData>>;
  createPixOnRamp(input: OnRampInput): Promise<FourPResponse<OnRampCreatedData>>;
  createPixOffRamp(input: OffRampInput): Promise<FourPResponse<OffRampCreatedData>>;
  getNotification(token: string): Promise<FourPResponse<NotificationData>>;
}
