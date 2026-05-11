import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number | string) {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n);
}

export function formatUSDC(value: number | string, digits = 2) {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} USDC`;
}

/** Formato pt-BR dólar — design system Poupapp */
export function formatUSD(value: number | string, digits = 2) {
  const n = typeof value === 'string' ? Number(value) : value;
  return `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatUSDCompact(value: number | string) {
  const n = typeof value === 'string' ? Number(value) : value;
  return `US$ ${Math.round(n).toLocaleString('pt-BR')}`;
}

export function formatPct(value: number, digits = 2) {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}
