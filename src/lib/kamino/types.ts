export type KaminoPosition = {
  usdcSupplied: number;
  usdcCurrentValue: number;
  apy: number;
  obligationPubkey: string | null;
};

export type PreparedTx = {
  txBase64: string;
  lookupTables?: string[];
};

export type DepositOpts = {
  targetPubkey?: string;
  targetMint?: string;
  targetLabel?: string;
};

export interface KaminoDriver {
  getPosition(wallet: string): Promise<KaminoPosition | null>;
  getCurrentApy(): Promise<number>;
  deposit(wallet: string, amountUSDC: number, opts?: DepositOpts): Promise<{ signature: string }>;
  withdraw(wallet: string, amountUSDC: number, opts?: DepositOpts): Promise<{ signature: string }>;
  prepareDeposit?(wallet: string, amountUSDC: number, opts?: DepositOpts): Promise<PreparedTx>;
  prepareWithdraw?(wallet: string, amountUSDC: number, opts?: DepositOpts): Promise<PreparedTx>;
  confirmDeposit?(wallet: string, signature: string, amountUSDC: number): Promise<void>;
  confirmWithdraw?(wallet: string, signature: string, amountUSDC: number): Promise<void>;
  adjustPosition?(wallet: string, deltaUSDC: number, reason: string): Promise<void>;
}
