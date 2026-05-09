import { Connection } from '@solana/web3.js';
import { env } from '@/env';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(env.SOLANA_RPC_URL ?? DEFAULT_RPC, 'confirmed');
  }
  return _connection;
}
