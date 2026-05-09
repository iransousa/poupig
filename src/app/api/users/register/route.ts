import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { encrypt } from '@/lib/crypto/encrypt';
import { isValidCPF, normalizeCPF } from '@/lib/validators/cpf';
import { isValidPixKey, normalizePixKey } from '@/lib/validators/pix';
import { requireSession } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

const schema = z.object({
  fullName: z.string().min(3).max(120),
  cpf: z.string().refine(isValidCPF, 'CPF inválido'),
  pixKey: z.string().refine(isValidPixKey, 'Chave PIX inválida'),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  if (!session.solanaWallet) {
    return NextResponse.json({ error: 'wallet_not_ready' }, { status: 400 });
  }
  if (!session.email && !session.phone) {
    return NextResponse.json({ error: 'contact_required' }, { status: 400 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { fullName, cpf, pixKey } = parsed.data;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        fullName,
        email: session.email ?? existing.email,
        phone: session.phone ?? existing.phone,
        cpfEncrypted: encrypt(normalizeCPF(cpf)),
        pixKeyEncrypted: encrypt(normalizePixKey(pixKey)),
        solanaWalletAddress: session.solanaWallet,
        onboardedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning({ id: users.id });
    return NextResponse.json({ id: updated.id, onboarded: true });
  }

  const [created] = await db
    .insert(users)
    .values({
      privyUserId: session.privyUserId,
      email: session.email,
      phone: session.phone,
      fullName,
      cpfEncrypted: encrypt(normalizeCPF(cpf)),
      pixKeyEncrypted: encrypt(normalizePixKey(pixKey)),
      solanaWalletAddress: session.solanaWallet,
      onboardedAt: new Date(),
    })
    .returning({ id: users.id });

  return NextResponse.json({ id: created.id, onboarded: true }, { status: 201 });
}
