import { env } from '@/env';
import { mockDriver } from './mock-client';
import { realDriver } from './real-client';
import type { FourPDriver } from './types';

const driver = env.FOUR_P_DRIVER;

if (driver !== 'mock' && driver !== 'real') {
  throw new Error(
    `FOUR_P_DRIVER inválido: "${driver}". Use 'mock' ou 'real' explicitamente no .env.`,
  );
}

if (driver === 'real' && !env.FOUR_P_API_KEY) {
  throw new Error(
    'FOUR_P_DRIVER=real exige FOUR_P_API_KEY no .env. Configure ou troque pra mock.',
  );
}

console.log(
  `\n[4P driver] ${driver === 'real' ? '🟢 REAL · api.4p.finance' : '🟡 MOCK · in-memory'}\n`,
);

export const fourP: FourPDriver = driver === 'real' ? realDriver : mockDriver;
export * from './types';
