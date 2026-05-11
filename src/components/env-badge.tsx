'use client';

import { useKaminoConfig } from '@/hooks/use-kamino-config';

const STYLES: Record<string, string> = {
  mock: 'bg-warning/15 text-warning ring-warning/30',
  staging: 'bg-accent-soft text-accent ring-accent/30',
  mainnet: 'bg-[var(--p-green)]/15 text-[var(--p-green)] ring-[var(--p-green)]/30',
};

const LABELS: Record<string, string> = {
  mock: 'MOCK',
  staging: 'STAGING',
  mainnet: 'LIVE',
};

export function EnvBadge() {
  const { data: cfg } = useKaminoConfig();
  const env = cfg?.env ?? 'mock';
  const style = STYLES[env] ?? STYLES.mock;
  const label = LABELS[env] ?? env.toUpperCase();
  return (
    <span
      className={`chip ring-1 ${style}`}
      style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}
      title={`Kamino: ${env}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
      {label}
    </span>
  );
}
