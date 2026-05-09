import { env } from '@/env';
import type {
  FourPDriver,
  FourPResponse,
  OnRampCreatedData,
  OffRampCreatedData,
  NotificationData,
  PriceConversionData,
  OnRampInput,
  OffRampInput,
  QuoteInput,
} from './types';

/**
 * Cada chamada armazena no globalThis o último request/response — útil pra
 * a rota de criação salvar tudo em transaction_events depois.
 */
type LastCall = {
  url: string;
  method: string;
  reqBody: unknown;
  status: number;
  resBody: unknown;
  resText: string;
  ok: boolean;
  timestamp: string;
};

const g = globalThis as unknown as { __poupapp4PLastCalls?: Map<string, LastCall> };
if (!g.__poupapp4PLastCalls) g.__poupapp4PLastCalls = new Map();

function recordCall(key: string, call: LastCall) {
  g.__poupapp4PLastCalls!.set(key, call);
  // só mantém últimas 200 entradas pra não crescer infinito
  if (g.__poupapp4PLastCalls!.size > 200) {
    const firstKey = g.__poupapp4PLastCalls!.keys().next().value;
    if (firstKey) g.__poupapp4PLastCalls!.delete(firstKey);
  }
}

export function getLastCall(key: string): LastCall | undefined {
  return g.__poupapp4PLastCalls?.get(key);
}

async function request<T>(
  path: string,
  init: RequestInit,
  recordKey?: string,
): Promise<FourPResponse<T>> {
  if (!env.FOUR_P_API_KEY) {
    throw new Error('FOUR_P_API_KEY missing — set FOUR_P_DRIVER=mock to run without it');
  }
  const url = `${env.FOUR_P_API_BASE}${path}`;
  const reqBody = init.body ? safeJsonParse(init.body as string) : undefined;
  const res = await fetch(url, {
    ...init,
    headers: {
      'x-api-key': env.FOUR_P_API_KEY,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const rawText = await res.text();
  let body: FourPResponse<T> | undefined;
  try {
    body = JSON.parse(rawText) as FourPResponse<T>;
  } catch {
    // keep undefined
  }

  if (recordKey) {
    recordCall(recordKey, {
      url,
      method: init.method ?? 'GET',
      reqBody,
      status: res.status,
      resBody: body,
      resText: rawText.slice(0, 4000),
      ok: res.ok && Boolean(body?.success),
      timestamp: new Date().toISOString(),
    });
  }

  if (!res.ok || !body || !body.success) {
    console.error('[4p request failed]', {
      url,
      method: init.method ?? 'GET',
      status: res.status,
      reqBody: init.body,
      resBody: rawText.slice(0, 800),
    });
    const httpCode = body?.http_code ?? res.status;
    const msg =
      body?.details?.message ||
      body?.details?.result ||
      body?.info?.message ||
      body?.info?.result ||
      rawText.slice(0, 200) ||
      `HTTP ${res.status}`;
    throw new Error(`4P ${path} failed: ${httpCode} ${msg}`);
  }
  if (!body.info && body.details?.data) {
    body.info = {
      result: body.details.result,
      message: body.details.message,
      data: body.details.data,
    };
  }
  return body;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export const realDriver: FourPDriver = {
  priceConversion: (input: QuoteInput) =>
    request<PriceConversionData>(
      '/v1/transaction/price_conversion',
      {
        method: 'POST',
        body: JSON.stringify({
          amount: input.amount,
          currency_from_symbol: input.from,
          convert: input.to,
        }),
      },
      `quote-${Date.now()}`,
    ),

  createPixOnRamp: (input: OnRampInput) =>
    request<OnRampCreatedData>(
      '/v1/pix/transaction',
      {
        method: 'PUT',
        body: JSON.stringify({
          cpf: input.cpf,
          email: input.email,
          amount: input.amountBRL,
          expires: input.expires ?? 3600,
          custom_id: input.customId,
          custom_data: { receiver_wallet: input.receiverWallet },
          description: input.description ?? 'Deposito PoupApp',
          notification_url: input.notificationUrl,
        }),
      },
      `onramp-${input.customId}`,
    ),

  createPixOffRamp: (input: OffRampInput) =>
    request<OffRampCreatedData>(
      '/v1/cryptopix/transaction',
      {
        method: 'PUT',
        body: JSON.stringify({
          person_document: input.cpf,
          email: input.email,
          amount_crypto: input.amountUSDC,
          custom_id: input.customId,
          custom_data: { asset: 'USDC', chain: 'Solana' },
          sender_wallet: input.senderWallet,
          destination_pix_key: input.destinationPixKey,
          notification_url: input.notificationUrl,
        }),
      },
      `offramp-${input.customId}`,
    ),

  getNotification: (token: string) =>
    request<NotificationData>(
      `/v1/notification/${token}`,
      { method: 'GET' },
      `notification-${token}`,
    ),
};
