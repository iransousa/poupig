'use client';

import { LifeBuoy } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink-50">Suporte</h1>
        <p className="text-sm text-ink-400">Atendimento aos clientes via chat</p>
      </header>

      <div className="card flex flex-col items-center justify-center p-12 text-center">
        <LifeBuoy className="mb-4 h-12 w-12 text-ink-600" />
        <h2 className="font-display text-xl font-bold text-ink-100">Em construção</h2>
        <p className="mt-2 max-w-md text-sm text-ink-400">
          Integração com Chatwoot planejada pra Sprint A6. Por enquanto, use a aba de Clientes pra
          ver detalhes e atuar em cada conta.
        </p>
      </div>
    </div>
  );
}
