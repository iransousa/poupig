'use client';

import { useKaminoConfig } from '@/hooks/use-kamino-config';

const STYLES: Record<string, { bg: string; text: string; label: string }> = {
  mock: { bg: 'bg-amber-500/15 ring-amber-500/30', text: 'text-amber-300', label: 'MOCK' },
  staging: { bg: 'bg-brand-500/15 ring-brand-400/30', text: 'text-brand-300', label: 'STAGING' },
  mainnet: { bg: 'bg-emerald-500/15 ring-emerald-400/30', text: 'text-emerald-300', label: 'LIVE' },
};

export function EnvBadge() {
  const { data: cfg } = useKaminoConfig();
  const env = cfg?.env ?? 'mock';
  const style = STYLES[env] ?? STYLES.mock;
  return (
    <span className={`chip ring-1 ${style.bg} ${style.text}`} title={`Kamino: ${env}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
      {style.label}
    </span>
  );
}
