import { PrivyClient } from '@privy-io/server-auth';
import { env } from '@/env';

export const privy = new PrivyClient(env.NEXT_PUBLIC_PRIVY_APP_ID, env.PRIVY_APP_SECRET);

export async function verifyPrivyToken(token: string) {
  const claims = await privy.verifyAuthToken(token);
  return claims;
}

type AnyAccount = Record<string, unknown> & { type?: string; address?: string };

function pickEmail(user: unknown): string | null {
  const u = user as Record<string, unknown>;
  const email = (u.email as { address?: string } | undefined)?.address;
  if (email) return email;
  const google = u.google as { email?: string } | undefined;
  if (google?.email) return google.email;
  const apple = u.apple as { email?: string } | undefined;
  if (apple?.email) return apple.email;
  const github = u.github as { email?: string } | undefined;
  if (github?.email) return github.email;
  const discord = u.discord as { email?: string } | undefined;
  if (discord?.email) return discord.email;
  const linked = (u.linkedAccounts as AnyAccount[] | undefined) ?? [];
  for (const a of linked) {
    const maybeEmail = (a as { email?: string }).email;
    if (maybeEmail) return maybeEmail;
  }
  return null;
}

function pickPhone(user: unknown): string | null {
  const u = user as Record<string, unknown>;
  const phone = (u.phone as { number?: string } | undefined)?.number;
  return phone ?? null;
}

function pickSolanaWallet(user: unknown): string | null {
  const u = user as Record<string, unknown>;
  const linked = (u.linkedAccounts as AnyAccount[] | undefined) ?? [];
  const wallet = linked.find(
    (a) =>
      a.type === 'wallet' &&
      ('chainType' in a ? (a as { chainType?: string }).chainType === 'solana' : false),
  );
  return (wallet?.address as string | undefined) ?? null;
}

export async function getPrivyUser(userId: string) {
  const user = await privy.getUser(userId);
  return {
    id: user.id,
    email: pickEmail(user),
    phone: pickPhone(user),
    solanaWallet: pickSolanaWallet(user),
  };
}
