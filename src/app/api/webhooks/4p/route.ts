import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { env } from '@/env';
import { db } from '@/lib/db/client';
import { transactions, transactionEvents } from '@/lib/db/schema';
import { syncTransactionFromToken } from '@/lib/four-p/reconcile';

function extractClientIp(req: Request): string | null {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return null;
}

/**
 * Tenta extrair o token de notificação da 4P do body do POST.
 * Documentação não é clara sobre o nome exato do campo, então testamos
 * variações comuns.
 */
function extractFourPToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  // Possíveis nomes do campo
  const candidates = ['token', 'notification_token', 'notificationToken', 'notif_token', 'id'];
  for (const key of candidates) {
    const v = b[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  // Pode estar aninhado: { data: { token } } ou { info: { token } }
  for (const wrapKey of ['data', 'info', 'notification']) {
    const wrap = b[wrapKey];
    if (wrap && typeof wrap === 'object') {
      for (const key of candidates) {
        const v = (wrap as Record<string, unknown>)[key];
        if (typeof v === 'string' && v.length > 0) return v;
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const ourToken = url.searchParams.get('token');
  const ip = extractClientIp(req);

  // Lê body cru pra log (pode falhar se vier vazio)
  let bodyText = '';
  let bodyJson: unknown = null;
  try {
    bodyText = await req.text();
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    // continua, vamos logar bodyText
  }

  console.log('[webhook 4p] received', {
    ourToken: ourToken?.slice(0, 12),
    ip,
    bodyText: bodyText.slice(0, 500),
    headers: {
      cf: req.headers.get('cf-connecting-ip'),
      xff: req.headers.get('x-forwarded-for'),
      ua: req.headers.get('user-agent'),
    },
  });

  if (!ourToken) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }

  // IP allowlist (opcional)
  if (env.FOUR_P_DRIVER === 'real' && env.FOUR_P_WEBHOOK_IP_ALLOWLIST) {
    const allow = env.FOUR_P_WEBHOOK_IP_ALLOWLIST.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allow.length > 0 && !allow.includes('*')) {
      if (!ip || !allow.includes(ip)) {
        console.warn('[webhook 4p] IP not in allowlist', { ip, allow });
        return NextResponse.json({ error: 'forbidden', ip }, { status: 403 });
      }
    }
  }

  // Mapeia tx pelo nosso token (URL query)
  const [tx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.fourPToken, ourToken))
    .limit(1);

  if (!tx) {
    console.warn('[webhook 4p] no tx found for our token', { ourToken });
    return NextResponse.json({ ok: true, note: 'tx_not_found' });
  }

  // Extrai token da 4P do body e salva
  const fourPToken = extractFourPToken(bodyJson);
  if (fourPToken) {
    await db
      .update(transactions)
      .set({ fourPNotificationToken: fourPToken })
      .where(eq(transactions.id, tx.id));
  }

  // Audit raw payload
  await db.insert(transactionEvents).values({
    transactionId: tx.id,
    eventType: 'webhook_received',
    payload: { body: bodyJson ?? bodyText, ip, fourPToken },
  });

  // Sync async (usa o token da 4P se temos, senão o nosso como fallback)
  const tokenToSync = fourPToken ?? ourToken;
  syncTransactionFromToken(tokenToSync, tx.id).catch((err) => {
    console.error('[webhook 4p] sync failed', err);
  });

  return NextResponse.json({ ok: true });
}
