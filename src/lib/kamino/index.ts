import { mockKaminoDriver } from './mock-driver';
import { realKaminoDriver } from './real-driver';
import type { KaminoDriver } from './types';
import { getKaminoConfig } from './config';

const cfg = getKaminoConfig();
const isMock = cfg.env === 'mock';

const ICONS = {
  mock: '🟡 MOCK · in-memory',
  staging: '🟣 STAGING · klend SLendK7y...',
  mainnet: '🟢 MAINNET · klend KLend2g3...',
} as const;

console.log(`\n[Kamino driver] ${ICONS[cfg.env] ?? cfg.env}\n`);

export const kamino: KaminoDriver = isMock ? mockKaminoDriver : realKaminoDriver;

export * from './types';
export { getKaminoConfig, explorerUrl } from './config';
