import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  DATABASE_URL: z.string().url(),
  DB_ENCRYPTION_KEY: z.string().min(32),
  FOUR_P_API_KEY: z.string().optional(),
  FOUR_P_API_BASE: z.string().url().default('https://api.4p.finance'),
  FOUR_P_WEBHOOK_IP_ALLOWLIST: z.string().default('44.196.63.157'),
  // Sem default — força configuração explícita
  FOUR_P_DRIVER: z.enum(['mock', 'real']),
  NEXT_PUBLIC_FOUR_P_DRIVER: z.enum(['mock', 'real']),
  SOLANA_RPC_URL: z.string().url().optional(),
  // Sem default — força configuração explícita.
  KAMINO_ENV: z.enum(['mock', 'staging', 'devnet', 'mainnet']),
  KAMINO_PROGRAM_ID: z.string().optional(),
  KAMINO_MARKET_PUBKEY: z.string().optional(),
  NEXT_PUBLIC_KAMINO_ENV: z.enum(['mock', 'staging', 'devnet', 'mainnet']),
  CRON_SECRET: z.string().optional(),
  ENABLE_IN_PROCESS_CRON: z.enum(['true', 'false']).default('false'),
});

type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);
if (!parsed.success && typeof window === 'undefined') {
  console.error('Env validation failed:', parsed.error.flatten().fieldErrors);
}

export const env: Env = (parsed.success ? parsed.data : process.env) as Env;
