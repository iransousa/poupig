/**
 * Parse simples de um BR Code PIX (EMVCo).
 * Retorna campos relevantes pra inspeção: chave PIX, nome do beneficiário, valor.
 *
 * Formato EMVCo: cada campo é "ID(2) + LEN(2) + VALUE(LEN)"
 */
export type PixDecoded = {
  pixKey?: string;
  merchantName?: string;
  merchantCity?: string;
  amount?: string;
  txId?: string;
  raw: Record<string, string>;
};

function parseTLV(input: string, offset = 0, end = input.length): Record<string, string> {
  const out: Record<string, string> = {};
  let i = offset;
  while (i < end - 4) {
    const id = input.slice(i, i + 2);
    const lenStr = input.slice(i + 2, i + 4);
    const len = parseInt(lenStr, 10);
    if (Number.isNaN(len)) break;
    const value = input.slice(i + 4, i + 4 + len);
    out[id] = value;
    i += 4 + len;
  }
  return out;
}

export function decodePixBrCode(brcode: string): PixDecoded {
  if (!brcode || brcode.length < 10) return { raw: {} };
  const top = parseTLV(brcode);

  // Merchant Account Information (ID 26 - PIX)
  const pixField = top['26'] ?? '';
  const pixSub = parseTLV(pixField);

  // Additional Data Field Template (ID 62 - txId)
  const additional = parseTLV(top['62'] ?? '');

  return {
    pixKey: pixSub['01'],
    merchantName: top['59'],
    merchantCity: top['60'],
    amount: top['54'],
    txId: additional['05'],
    raw: { ...top, ...Object.fromEntries(Object.entries(pixSub).map(([k, v]) => [`26.${k}`, v])) },
  };
}
