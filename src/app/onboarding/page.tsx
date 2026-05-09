'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ShieldCheck, Wallet } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useMe } from '@/hooks/use-me';
import { formatCPF, isValidCPF } from '@/lib/validators/cpf';
import { isValidPixKey } from '@/lib/validators/pix';

export default function OnboardingPage() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { wallets, createWallet } = useSolanaWallets();
  const { data: me, isLoading, refetch } = useMe();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);

  const solanaWallet = wallets[0]?.address ?? me?.solanaWalletAddress ?? null;

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (me?.onboarded) router.push('/app');
  }, [me, router]);

  async function handleCreateWallet() {
    setCreatingWallet(true);
    try {
      await createWallet();
      await refetch();
      toast.success('Carteira criada!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar carteira');
    } finally {
      setCreatingWallet(false);
    }
  }

  const cpfValid = isValidCPF(cpf);
  const pixValid = isValidPixKey(pixKey);
  const nameValid = fullName.trim().length >= 3;
  const canSubmit = cpfValid && pixValid && nameValid && !submitting && !!solanaWallet;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/users/register', {
        method: 'POST',
        body: JSON.stringify({ fullName: fullName.trim(), cpf, pixKey: pixKey.trim() }),
      });
      qc.setQueryData(['me'], (prev: unknown) => ({
        ...((prev as object | null) ?? {}),
        fullName: fullName.trim(),
        solanaWalletAddress: solanaWallet,
        onboarded: true,
      }));
      await qc.refetchQueries({ queryKey: ['me'] });
      toast.success('Cadastro concluído!');
      router.replace('/app');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-300">
        Carregando...
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <form onSubmit={handleSubmit} className="card w-full max-w-md animate-slide-up">
        <h1 className="font-display text-3xl font-bold text-ink-50">Bem-vindo 👋</h1>
        <p className="mt-1 text-sm text-ink-300">
          Só mais alguns dados pra liberar depósitos via PIX.
        </p>

        <div
          className={`mt-5 flex items-start gap-3 rounded-2xl p-3 ring-1 ${
            solanaWallet
              ? 'bg-brand-500/10 text-brand-200 ring-brand-500/30'
              : 'bg-amber-500/10 text-amber-200 ring-amber-500/30'
          }`}
        >
          <div
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
              solanaWallet ? 'bg-brand-500/20 text-brand-300' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {solanaWallet ? <ShieldCheck className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
          </div>
          <div className="flex-1 text-sm">
            {solanaWallet ? (
              <>
                <p className="font-semibold">Carteira Solana pronta</p>
                <p className="mt-0.5 break-all font-mono text-[10px] opacity-80">
                  {solanaWallet}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Carteira não criada</p>
                <p className="mt-0.5 text-xs opacity-90">
                  Precisamos criar sua carteira Solana pra receber os USDC.
                </p>
                <button
                  type="button"
                  onClick={handleCreateWallet}
                  disabled={creatingWallet}
                  className="mt-3 w-full rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {creatingWallet ? 'Criando...' : 'Criar carteira'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Nome completo">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
              className="input-base"
            />
          </Field>
          <Field label="CPF" error={cpf && !cpfValid ? 'CPF inválido' : undefined}>
            <input
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className="input-base"
            />
          </Field>
          <Field
            label="Chave PIX (para saques)"
            error={pixKey && !pixValid ? 'Chave PIX inválida' : undefined}
          >
            <input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="email, CPF, telefone ou chave aleatória"
              className="input-base"
            />
          </Field>
        </div>

        <button type="submit" disabled={!canSubmit} className="btn-primary mt-6 w-full py-4">
          {submitting ? 'Salvando...' : (
            <>
              <Check className="h-4 w-4" />
              Continuar
            </>
          )}
        </button>

        <p className="mt-4 text-center text-[11px] text-ink-500">
          Seus dados são criptografados antes de serem armazenados.
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-field">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}
